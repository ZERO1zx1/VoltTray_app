//! M220 info query only: no firmware, DPI, button or configuration writes.
use super::{read_trimmed, PeripheralDeviceDto};
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    os::unix::fs::OpenOptionsExt,
    sync::Mutex,
    time::{Duration, Instant},
};

#[derive(Clone, Debug, PartialEq)]
pub(super) struct Reading {
    pub pct: u8,
    pub charging: bool,
}

pub(super) fn parse(report: &[u8]) -> Option<Reading> {
    if report.len() != 32
        || report[0] != 0x10
        || report[1] != 0
        || report[3] < 11
        || report[3] > 27
        || &report[4..8] != b"M220"
        || report[12] > 1
        || report[13] > 100
        || report[14] == 0
    {
        return None;
    }
    if report[4..31]
        .iter()
        .fold(0u8, |sum, b| sum.wrapping_add(*b))
        != report[31]
    {
        return None;
    }
    Some(Reading {
        pct: report[13],
        charging: report[12] == 1,
    })
}

// Cache failures too; multiple UI polls must not repeatedly wake the mouse.
static CACHE: Mutex<Vec<(String, Instant, Option<Reading>)>> = Mutex::new(Vec::new());

fn query(path: &std::path::Path) -> Option<Reading> {
    let mut file = OpenOptions::new()
        .read(true)
        .write(true)
        .custom_flags(0x800)
        .open(path)
        .ok()?; // Linux O_NONBLOCK
    let mut request = [0u8; 33]; // leading report ID 0, then 32-byte payload
    request[1] = 0x10;
    if file.write(&request).ok()? != request.len() {
        return None;
    }
    let deadline = Instant::now() + Duration::from_millis(500);
    let mut report = [0u8; 64];
    while Instant::now() < deadline {
        match file.read(&mut report) {
            Ok(32) => {
                if let Some(value) = parse(&report[..32]) {
                    return Some(value);
                }
            }
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(_) => return None,
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    None
}

pub(super) fn enrich(devices: &mut [PeripheralDeviceDto]) {
    let Ok(entries) = fs::read_dir("/sys/class/hidraw") else {
        return;
    };
    let Ok(mut cache) = CACHE.lock() else { return };
    cache.retain(|(_, time, _)| time.elapsed() < Duration::from_secs(30));
    for entry in entries.flatten() {
        let device_path = entry.path().join("device");
        if super::usb_identity::interface(&device_path).0 != 2 {
            continue;
        }
        let event = read_trimmed(&device_path.join("uevent"));
        let id = super::uevent_value(&event, "HID_ID").to_lowercase();
        if !["0003:0000248a:00005d2e", "0003:0000249a:00005c2f"].contains(&id.as_str()) {
            continue;
        }
        // Require the exact 32-byte no-report-ID interface observed on this model.
        let expected = [
            5, 1, 9, 0, 161, 1, 25, 0, 42, 255, 0, 21, 0, 38, 255, 0, 117, 8, 149, 32, 129, 1, 117,
            8, 149, 32, 145, 1, 192,
        ];
        if fs::read(device_path.join("report_descriptor"))
            .ok()
            .as_deref()
            != Some(&expected[..])
        {
            continue;
        }
        let phys = super::uevent_value(&event, "HID_PHYS").to_lowercase();
        let key = format!(
            "usb:{}|{}",
            phys.split("/input").next().unwrap_or(&phys),
            id
        );
        let reading = if let Some((_, _, value)) = cache.iter().find(|(k, _, _)| k == &key) {
            value.clone()
        } else {
            let value = query(&std::path::Path::new("/dev").join(entry.file_name()));
            cache.push((key.clone(), Instant::now(), value.clone()));
            value
        };
        if let Some(reading) = reading {
            if let Some(device) = devices
                .iter_mut()
                .find(|d| d.device_id.as_deref() == Some(&key))
            {
                device.battery_pct = reading.pct;
                device.battery_available = true;
                device.charging_state = if reading.charging {
                    "charging"
                } else {
                    "discharging"
                }
                .into();
                device.battery_source = Some("M220 HID".into());
                device.label_en = "Valkyrie VK M3 Lite".into();
                device.label_mn = device.label_en.clone();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "requires a connected M220 mouse and MI_02 uaccess permission"]
    fn live_m220_battery() {
        let mut devices = super::super::probe_usb_hidraw();
        enrich(&mut devices);
        let readings: Vec<_> = devices
            .iter()
            .filter(|d| d.battery_source.as_deref() == Some("M220 HID"))
            .collect();
        for d in &readings {
            println!(
                "{}: {}%, {}, {}",
                d.label_en, d.battery_pct, d.charging_state, d.connection_type
            );
        }
        assert!(!readings.is_empty(), "No validated live M220 info response");
    }
    #[test]
    fn validates_info_instead_of_accepting_arbitrary_hid_data() {
        let mut data = [0u8; 32];
        data[0] = 0x10;
        data[2] = 1;
        data[3] = 11;
        data[4..8].copy_from_slice(b"M220");
        data[13] = 64;
        data[14] = 1;
        data[31] = data[4..31].iter().fold(0u8, |s, b| s.wrapping_add(*b));
        assert_eq!(
            parse(&data),
            Some(Reading {
                pct: 64,
                charging: false
            })
        );
        data[13] = 65;
        assert_eq!(parse(&data), None); // invalid checksum
        assert_eq!(parse(&data[..16]), None);
        data[4] = b'N';
        assert_eq!(parse(&data), None); // shared receiver, other model
    }
}
