//! Optional, read-only adapter for an already-running kAirPods session service.
//! Contract reference: docs/2026-11-15/reports/deep-research/report.md.
use super::{make_device_dto, BatteryComponent, PeripheralDeviceDto};
use serde_json::Value;

pub(super) fn parse(raw: &str) -> Vec<PeripheralDeviceDto> {
    let Ok(envelope) = serde_json::from_str::<Value>(raw) else {
        return vec![];
    };
    if envelope["type"] != "s" {
        return vec![];
    }
    let Some(payload) = envelope["data"][0].as_str() else {
        return vec![];
    };
    let Ok(Value::Array(items)) = serde_json::from_str::<Value>(payload) else {
        return vec![];
    };
    let mut devices = Vec::new();
    for item in items {
        if item["connected"] != true {
            continue;
        }
        let Some(address) = item["address"].as_str() else {
            continue;
        };
        let parts: Vec<_> = address.split(':').collect();
        if parts.len() != 6
            || !parts
                .iter()
                .all(|p| p.len() == 2 && p.bytes().all(|c| c.is_ascii_hexdigit()))
        {
            continue;
        }
        let id = format!("bluetooth:{}", address.to_ascii_lowercase());
        if devices
            .iter()
            .any(|d: &PeripheralDeviceDto| d.device_id.as_ref() == Some(&id))
        {
            continue;
        }
        let components: Vec<_> = ["left", "right", "case", "headphone"]
            .iter()
            .filter_map(|&key| {
                let c = &item["battery"][key];
                let pct = c["level"].as_u64().filter(|n| *n <= 100)?;
                Some(BatteryComponent {
                    id: key.into(),
                    battery_pct: pct as u8,
                    charging: c["charging"].as_bool()?,
                })
            })
            .collect();
        // The case does not determine listening time or the earbud alert percentage.
        let listening: Vec<_> = components.iter().filter(|c| c.id != "case").collect();
        let active = if listening.is_empty() {
            components.iter().collect()
        } else {
            listening
        };
        let Some(pct) = active.iter().map(|c| c.battery_pct).min() else {
            continue;
        };
        let charging = active.iter().all(|c| c.charging);
        let name = item["name"]
            .as_str()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or("AirPods");
        let mut device = make_device_dto(
            devices.len(),
            "headset",
            "AirPods",
            "AirPods",
            name,
            pct,
            if charging { "charging" } else { "discharging" },
            "bluetooth",
            "other",
        );
        device.device_id = Some(id);
        device.battery_source = Some("kAirPods".into());
        device.battery_components = components;
        devices.push(device);
    }
    devices
}

pub(super) fn probe() -> Vec<PeripheralDeviceDto> {
    let Ok(output) = std::process::Command::new("busctl")
        .args([
            "--user",
            "--json=short",
            "--timeout=1s",
            "--auto-start=no",
            "--allow-interactive-authorization=no",
            "call",
            "org.kairpods",
            "/org/kairpods/manager",
            "org.kairpods.manager",
            "GetDevices",
        ])
        .output()
    else {
        return vec![];
    };
    if !output.status.success() {
        return vec![];
    }
    parse(&String::from_utf8_lossy(&output.stdout))
}

pub(super) fn enrich(devices: &mut Vec<PeripheralDeviceDto>, readings: Vec<PeripheralDeviceDto>) {
    for mut reading in readings {
        // Only exact provider IDs are safe to merge. Legacy name/percentage heuristics
        // must not combine two different pairs of headphones.
        if let Some(existing) = devices
            .iter_mut()
            .find(|d| d.device_id == reading.device_id)
        {
            reading.slot_id = existing.slot_id.clone();
            *existing = reading;
        } else if devices.len() < 8 {
            reading.slot_id = format!("slot_{}", devices.len() + 1);
            devices.push(reading);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_components_and_keeps_case_separate() {
        let payload = serde_json::json!([
            {"address":"AA:BB:CC:DD:EE:FF","name":"My AirPods","connected":true,
             "battery":{"left":{"level":0,"charging":false},"right":{"level":82,"charging":true},"case":{"level":99,"charging":true}}},
            {"address":"11:22:33:44:55:66","connected":false,"battery":{"left":{"level":12,"charging":false}}},
            {"address":"22:22:33:44:55:66","connected":true,"battery":{"headphone":{"level":255,"charging":false}}}
        ]);
        let output = serde_json::json!({"type":"s","data":[payload.to_string()]}).to_string();
        let devices = parse(&output);
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].battery_pct, 0);
        assert_eq!(devices[0].charging_state, "discharging");
        assert_eq!(devices[0].battery_components.len(), 3);
        assert_eq!(
            devices[0].device_id.as_deref(),
            Some("bluetooth:aa:bb:cc:dd:ee:ff")
        );
        assert!(parse("garbage").is_empty());
        assert!(parse(r#"{"type":"s","data":["null"]}"#).is_empty());
    }

    #[test]
    fn enriches_the_matching_bluetooth_identity_without_replacing_another_device() {
        let mut existing = make_device_dto(
            0,
            "headset",
            "AirPods",
            "AirPods",
            "AirPods",
            80,
            "unknown",
            "bluetooth",
            "other",
        );
        existing.device_id =
            super::super::bluetooth_identity("/org/bluez/hci0/dev_AA_BB_CC_DD_EE_FF");
        assert_eq!(
            existing.device_id.as_deref(),
            Some("bluetooth:aa:bb:cc:dd:ee:ff")
        );
        let mut update = existing.clone();
        update.battery_pct = 45;
        update.battery_source = Some("kAirPods".into());
        let mut devices = vec![existing];
        enrich(&mut devices, vec![update.clone()]);
        assert_eq!(devices.len(), 1);
        assert_eq!(devices[0].battery_pct, 45);
        update.device_id = Some("bluetooth:11:22:33:44:55:66".into());
        enrich(&mut devices, vec![update]);
        assert_eq!(devices.len(), 2);
    }
}
