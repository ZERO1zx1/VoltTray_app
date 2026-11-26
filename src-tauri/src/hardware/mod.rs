use serde::{Deserialize, Serialize};
#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "linux")]
use std::path::Path;

#[cfg(target_os = "linux")]
mod device_groups;
#[cfg(target_os = "linux")]
mod kairpods;
#[cfg(target_os = "linux")]
mod m220;
#[cfg(target_os = "linux")]
mod usb_identity;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeripheralDeviceDto {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub battery_source: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub connection_types: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub battery_components: Vec<BatteryComponent>,
    pub slot_id: String,
    #[serde(rename = "type")]
    pub device_type: String,
    pub label_en: String,
    pub label_mn: String,
    pub battery_pct: u8,
    pub battery_available: bool,
    pub charging_state: String,
    pub connection_type: String,
    pub connected: bool,
    pub supports_health: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub health_pct: Option<u8>,
    pub protocol_driver: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryComponent {
    pub id: String,
    pub battery_pct: u8,
    pub charging: bool,
}

#[cfg(target_os = "linux")]
fn bluetooth_identity(native_path: &str) -> Option<String> {
    let address = native_path.rsplit("dev_").next()?.replace('_', ":");
    let parts: Vec<_> = address.split(':').collect();
    (parts.len() == 6
        && parts
            .iter()
            .all(|p| p.len() == 2 && p.bytes().all(|c| c.is_ascii_hexdigit())))
    .then(|| format!("bluetooth:{}", address.to_ascii_lowercase()))
}

#[cfg(target_os = "linux")]
fn read_trimmed(path: &Path) -> String {
    fs::read_to_string(path)
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

fn sanitize_model_label(model: &str) -> String {
    let trimmed = model.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let lower = trimmed.to_lowercase();
    if lower.starts_with("hid-")
        || lower.starts_with("bat")
        || lower.starts_with("usb-")
        || lower.starts_with("ucsi-")
    {
        return String::new();
    }
    // Skip bare MAC addresses like aa:bb:cc:dd:ee:ff
    let is_mac = trimmed.len() == 17
        && trimmed.chars().enumerate().all(|(i, c)| {
            if i % 3 == 2 {
                c == ':' || c == '-'
            } else {
                c.is_ascii_hexdigit()
            }
        });
    if is_mac {
        return String::new();
    }
    trimmed.to_string()
}

#[cfg(target_os = "linux")]
fn is_generic_label(label: &str) -> bool {
    matches!(
        label.trim(),
        "System Battery"
            | "Wireless Mouse"
            | "Keyboard"
            | "Headset"
            | "Controller"
            | "USB / Mobile Device"
            | "Battery"
    )
}

fn has_bluetooth_token(hint: &str) -> bool {
    let lower = hint.to_lowercase();
    if lower.contains("bluez") || lower.contains("bluetooth") {
        return true;
    }
    lower
        .split(|c: char| !c.is_ascii_alphanumeric())
        .any(|tok| {
            tok == "ble"
                || tok == "bt"
                || (tok.starts_with("hci") && tok[3..].chars().all(|c| c.is_ascii_digit()))
        })
}

fn infer_type(name: &str, model: &str, scope: &str) -> (&'static str, &'static str, &'static str) {
    let name_lower = name.to_lowercase();
    if (name_lower.starts_with("bat") && name_lower[3..].chars().all(|c| c.is_ascii_digit()))
        || scope.eq_ignore_ascii_case("system")
    {
        return ("laptop", "System Battery", "Компьютерын батарей");
    }
    let hint = format!("{} {}", name_lower, model).to_lowercase();
    if [
        "mouse",
        "g pro",
        "superlight",
        "viper",
        "deathadder",
        "mx master",
        "basilisk",
        "aerox",
        "pulsefire",
    ]
    .iter()
    .any(|word| hint.contains(word))
    {
        ("mouse", "Wireless Mouse", "Утасгүй хулгана")
    } else if hint.contains("keyboard")
        || hint.contains("kbd")
        || hint.contains("keychron")
        || hint.contains("wooting")
        || hint.contains("blackwidow")
        || hint.contains("huntsman")
        || hint.contains("g915")
    {
        ("keyboard", "Keyboard", "Гар")
    } else if hint.contains("headset")
        || hint.contains("headphone")
        || hint.contains("arctis")
        || hint.contains("audio")
        || hint.contains("wh-1000")
        || hint.contains("airpods")
        || hint.contains("cloud")
        || hint.contains("barracuda")
        || hint.contains("blackshark")
        || hint.contains("hyperx")
        || hint.contains("corsair")
        || hint.contains("virtuoso")
        || hint.contains("void")
        || hint.contains("g733")
        || hint.contains("g535")
        || hint.contains("g435")
        || hint.contains("g935")
        || hint.contains("pro x")
    {
        ("headset", "Headset", "Чихэвч")
    } else if hint.contains("controller")
        || hint.contains("ps-controller")
        || hint.contains("dualsense")
        || hint.contains("dualshock")
        || hint.contains("xbox")
        || hint.contains("gaming-input")
        || hint.contains("gaming_input")
        || hint.contains("gamepad")
        || hint.contains("joy-con")
        || hint.contains("8bitdo")
    {
        ("controller", "Controller", "Гар удирдлага")
    } else if hint.contains("phone")
        || hint.contains("iphone")
        || hint.contains("ipad")
        || hint.contains("tablet")
        || hint.contains("android")
        || hint.contains("pixel")
        || hint.contains("galaxy")
        || hint.contains("ups")
    {
        ("other", "USB / Mobile Device", "USB / Утас төхөөрөмж")
    } else {
        ("unknown", "USB Device", "USB төхөөрөмж")
    }
}

// This boundary maps each independently probed hardware fact into the shared DTO.
#[allow(clippy::too_many_arguments)]
fn make_device_dto(
    slot_idx: usize,
    dev_type: &str,
    default_label_en: &str,
    default_label_mn: &str,
    model_name: &str,
    battery_pct: u8,
    charging_state: &str,
    conn: &str,
    driver: &str,
) -> PeripheralDeviceDto {
    let clean_model = if dev_type == "laptop" {
        String::new()
    } else {
        sanitize_model_label(model_name)
    };
    let label_en = if clean_model.is_empty() {
        default_label_en.to_string()
    } else {
        clean_model.clone()
    };
    let label_mn = if clean_model.is_empty() {
        default_label_mn.to_string()
    } else {
        clean_model
    };

    PeripheralDeviceDto {
        device_id: None,
        battery_source: None,
        connection_types: Vec::new(),
        battery_components: Vec::new(),
        slot_id: format!("slot_{}", slot_idx + 1),
        device_type: dev_type.to_string(),
        label_en,
        label_mn,
        battery_pct: battery_pct.min(100),
        battery_available: true,
        charging_state: charging_state.to_string(),
        connection_type: conn.to_string(),
        connected: true,
        supports_health: false,
        health_pct: None,
        protocol_driver: driver.to_string(),
    }
}

#[cfg(target_os = "linux")]
fn map_capacity_level(level: &str) -> Option<u8> {
    match level.trim().to_lowercase().as_str() {
        "full" => Some(100),
        "high" => Some(80),
        "normal" => Some(50),
        "low" => Some(15),
        "critical" => Some(5),
        _ => None,
    }
}

#[cfg(target_os = "linux")]
fn uevent_value(uevent: &str, key: &str) -> String {
    for line in uevent.lines() {
        if let Some((k, v)) = line.split_once('=') {
            if k.trim() == key {
                return v.trim().to_string();
            }
        }
    }
    String::new()
}

#[cfg(target_os = "linux")]
fn probe_sysfs() -> (bool, Vec<PeripheralDeviceDto>) {
    let base = Path::new("/sys/class/power_supply");
    let Ok(entries) = fs::read_dir(base) else {
        return (false, Vec::new());
    };

    let mut out = Vec::new();
    let mut charger_online = false;

    for entry in entries.flatten() {
        let dir = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let uevent = read_trimmed(&dir.join("uevent"));
        let dev_uevent = read_trimmed(&dir.join("device/uevent"));
        let real_path = fs::canonicalize(&dir)
            .map(|p| p.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let mut ptype = read_trimmed(&dir.join("type")).to_lowercase();
        if ptype.is_empty() {
            ptype = uevent_value(&uevent, "POWER_SUPPLY_TYPE").to_lowercase();
        }
        let mut scope = read_trimmed(&dir.join("scope")).to_lowercase();
        if scope.is_empty() {
            scope = uevent_value(&uevent, "POWER_SUPPLY_SCOPE").to_lowercase();
        }
        let online = {
            let s = read_trimmed(&dir.join("online"));
            if s.is_empty() {
                uevent_value(&uevent, "POWER_SUPPLY_ONLINE")
            } else {
                s
            }
        };
        let status = {
            let s = read_trimmed(&dir.join("status"));
            if s.is_empty() {
                uevent_value(&uevent, "POWER_SUPPLY_STATUS")
            } else {
                s
            }
        }
        .to_lowercase();

        let cap_str = {
            let s = read_trimmed(&dir.join("capacity"));
            if s.is_empty() {
                uevent_value(&uevent, "POWER_SUPPLY_CAPACITY")
            } else {
                s
            }
        };
        let level_str = {
            let s = read_trimmed(&dir.join("capacity_level"));
            if s.is_empty() {
                uevent_value(&uevent, "POWER_SUPPLY_CAPACITY_LEVEL")
            } else {
                s
            }
        };
        let parsed_cap = cap_str
            .parse::<u8>()
            .ok()
            .or_else(|| map_capacity_level(&level_str));

        let is_charger = ptype == "mains"
            || (ptype.starts_with("usb") && !(scope == "device" && parsed_cap.is_some()));

        if is_charger {
            if online == "1" || status == "online" {
                charger_online = true;
            }
            continue;
        }

        if out.len() >= 8 {
            continue;
        }

        let Some(cap) = parsed_cap else {
            continue;
        };

        let mut model = read_trimmed(&dir.join("model_name"));
        if model.is_empty() {
            model = uevent_value(&uevent, "POWER_SUPPLY_MODEL_NAME");
        }
        if model.is_empty() {
            model = read_trimmed(&dir.join("device/name"));
        }
        if model.is_empty() {
            model = uevent_value(&dev_uevent, "HID_NAME");
        }

        let hid_phys = uevent_value(&dev_uevent, "HID_PHYS").to_lowercase();

        if status == "charging" || status == "pending-charge" {
            charger_online = true;
        }

        let (dev_type, label_en, label_mn) = infer_type(&name, &model, &scope);
        let hint = format!("{} {} {} {}", name, model, hid_phys, real_path).to_lowercase();
        let conn = if dev_type == "laptop" || status == "charging" {
            "wired_usb"
        } else if hid_phys.starts_with("hci") || has_bluetooth_token(&hint) {
            "bluetooth"
        } else if hid_phys.starts_with("usb-") || real_path.contains("/usb") {
            if dev_type == "other" {
                "wired_usb"
            } else {
                "usb_dongle_2_4ghz"
            }
        } else {
            "usb_dongle_2_4ghz"
        };

        let driver = if hint.contains("hidpp") {
            "hidpp"
        } else if hint.contains("razer") {
            "razer_openrazer"
        } else if hint.contains("steelseries") || hint.contains("arctis") {
            "steelseries_hid"
        } else if conn == "bluetooth" {
            "standard_ble_bas"
        } else {
            "upower_generic"
        };
        let charging_state = match status.as_str() {
            "charging" | "pending-charge" => "charging",
            "discharging" => "discharging",
            "full" | "fully-charged" => "full",
            "not charging" | "not-charging" => "paused_limit",
            _ => "discharging",
        };

        let energy_full = read_trimmed(&dir.join("energy_full"))
            .parse::<f64>()
            .ok()
            .or_else(|| read_trimmed(&dir.join("charge_full")).parse::<f64>().ok());
        let energy_design = read_trimmed(&dir.join("energy_full_design"))
            .parse::<f64>()
            .ok()
            .or_else(|| {
                read_trimmed(&dir.join("charge_full_design"))
                    .parse::<f64>()
                    .ok()
            });

        let mut dto = make_device_dto(
            out.len(),
            dev_type,
            label_en,
            label_mn,
            &model,
            cap,
            charging_state,
            conn,
            driver,
        );
        dto.battery_source = Some("sysfs".to_string());
        if let (Some(full), Some(design)) = (energy_full, energy_design) {
            if full > 0.0 && design > 0.0 {
                let pct = ((full / design) * 100.0).round().clamp(1.0, 100.0) as u8;
                dto.supports_health = true;
                dto.health_pct = Some(pct);
            }
        }
        out.push(dto);
    }
    (charger_online, out)
}

#[cfg(target_os = "linux")]
fn is_upower_kind(s: &str) -> bool {
    matches!(
        s,
        "line-power"
            | "battery"
            | "mouse"
            | "keyboard"
            | "headset"
            | "headphones"
            | "gaming-input"
            | "phone"
            | "tablet"
            | "ups"
            | "media-player"
    )
}

#[cfg(target_os = "linux")]
fn probe_upower() -> (bool, Vec<PeripheralDeviceDto>) {
    let Ok(output) = std::process::Command::new("upower").arg("-d").output() else {
        return (false, Vec::new());
    };
    if !output.status.success() {
        return (false, Vec::new());
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let mut out = Vec::new();
    let mut charger_online = false;

    for block in text.split("\nDevice:") {
        let first_line = block.lines().next().unwrap_or("").trim().to_lowercase();
        let obj_path = first_line.trim_start_matches("device:").trim();
        if obj_path.is_empty() || obj_path.contains("displaydevice") {
            continue;
        }

        let mut kind = String::new();
        let mut model = String::new();
        let mut vendor = String::new();
        let mut native_path = String::new();
        let mut icon_name = String::new();
        let mut capacity_level = String::new();
        let mut state = String::new();
        let mut power_supply = false;
        let mut present: Option<bool> = None;
        let mut online = false;
        let mut pct: Option<u8> = None;

        for raw in block.lines() {
            let line = raw.trim();
            if line.is_empty() {
                continue;
            }
            if let Some((k, v)) = line.split_once(':') {
                let key = k.trim().to_lowercase();
                let val = v.trim();
                match key.as_str() {
                    "model" => model = val.to_string(),
                    "vendor" => vendor = val.to_string(),
                    "native-path" => native_path = val.to_string(),
                    "icon-name" => icon_name = val.to_lowercase(),
                    "capacity-level" => capacity_level = val.to_string(),
                    "power supply" => power_supply = val.eq_ignore_ascii_case("yes"),
                    "present" => present = Some(val.eq_ignore_ascii_case("yes")),
                    "online" => online = val.eq_ignore_ascii_case("yes"),
                    "state" => state = val.to_lowercase(),
                    "percentage" => {
                        if let Ok(parsed) = val.trim_end_matches('%').trim().parse::<f32>() {
                            if parsed.is_finite() && (0.0..=100.0).contains(&parsed) {
                                pct = Some(parsed.round() as u8);
                            }
                        }
                    }
                    k_other if is_upower_kind(k_other) && kind.is_empty() => {
                        kind = k_other.to_string();
                    }
                    _ => {}
                }
            } else {
                let bare = line.to_lowercase();
                if kind.is_empty() && is_upower_kind(&bare) {
                    kind = bare;
                }
            }
        }

        if obj_path.contains("line_power") || kind == "line-power" {
            if online {
                charger_online = true;
            }
            continue;
        }

        if out.len() >= 8 {
            continue;
        }

        let resolved_pct = pct.or_else(|| map_capacity_level(&capacity_level));
        let Some(battery_pct) = resolved_pct else {
            continue;
        };
        if present == Some(false) && battery_pct == 0 {
            continue;
        }

        if kind.is_empty() {
            if obj_path.contains("battery_bat") {
                kind = "battery".to_string();
            } else if obj_path.contains("/mouse") {
                kind = "mouse".to_string();
            } else if obj_path.contains("/keyboard") {
                kind = "keyboard".to_string();
            } else if obj_path.contains("/headset") || obj_path.contains("/headphones") {
                kind = "headset".to_string();
            } else if obj_path.contains("/gaming") {
                kind = "gaming-input".to_string();
            } else if obj_path.contains("/phone") {
                kind = "phone".to_string();
            } else if obj_path.contains("/tablet") || obj_path.contains("/media-player") {
                kind = "tablet".to_string();
            } else if obj_path.contains("/ups") {
                kind = "ups".to_string();
            }
        }

        let hint = format!(
            "{} {} {} {} {}",
            obj_path, native_path, model, vendor, icon_name
        )
        .to_lowercase();
        let is_system_laptop = obj_path.contains("battery_bat")
            || (kind == "battery"
                && power_supply
                && !hint.contains("hid")
                && !hint.contains("usb")
                && !has_bluetooth_token(&hint));

        let (dev_type, label_en, label_mn) = if is_system_laptop {
            ("laptop", "System Battery", "Компьютерын батарей")
        } else {
            match kind.as_str() {
                "mouse" => ("mouse", "Wireless Mouse", "Утасгүй хулгана"),
                "keyboard" => ("keyboard", "Keyboard", "Гар"),
                "headset" | "headphones" => ("headset", "Headset", "Чихэвч"),
                "gaming-input" => ("controller", "Controller", "Гар удирдлага"),
                "phone" | "tablet" | "ups" | "media-player" => {
                    ("other", "USB / Mobile Device", "USB / Утас төхөөрөмж")
                }
                _ => infer_type(
                    &format!("{} {} {}", obj_path, native_path, icon_name),
                    &format!("{} {}", vendor, model),
                    "Device",
                ),
            }
        };

        let charging_state = match state.as_str() {
            "charging" | "pending-charge" => {
                charger_online = true;
                "charging"
            }
            "fully-charged" | "full" => "full",
            _ => "discharging",
        };

        let conn = if dev_type == "laptop" {
            "wired_usb"
        } else if has_bluetooth_token(&hint) {
            "bluetooth"
        } else if charging_state == "charging"
            || (dev_type == "other" && (hint.contains("usb") || kind == "phone" || kind == "ups"))
        {
            "wired_usb"
        } else {
            "usb_dongle_2_4ghz"
        };
        let driver = if hint.contains("hidpp") {
            "hidpp"
        } else if conn == "bluetooth" {
            "standard_ble_bas"
        } else {
            "upower_generic"
        };

        let mut device = make_device_dto(
            out.len(),
            dev_type,
            label_en,
            label_mn,
            &model,
            battery_pct,
            charging_state,
            conn,
            driver,
        );
        device.device_id = bluetooth_identity(&native_path);
        device.battery_source = Some("UPower".into());
        out.push(device);
    }
    (charger_online, out)
}

#[cfg(target_os = "linux")]
fn probe_openrazer_sysfs() -> Vec<PeripheralDeviceDto> {
    let drivers = ["razermouse", "razerkbd", "razerheadset", "razeraccessory"];
    let mut out = Vec::new();
    for drv in drivers {
        let base = Path::new("/sys/bus/hid/drivers").join(drv);
        let Ok(entries) = fs::read_dir(base) else {
            continue;
        };
        for entry in entries.flatten() {
            let dir = entry.path();
            let level_raw = read_trimmed(&dir.join("charge_level"));
            let Ok(level) = level_raw.parse::<u16>() else {
                continue;
            };
            if level > 255 {
                continue;
            }
            let pct = ((level as u32 * 100 + 127) / 255).min(100) as u8;
            let status_raw = read_trimmed(&dir.join("charge_status"));
            let charging_state = if status_raw == "1" {
                "charging"
            } else {
                "discharging"
            };
            let model = {
                let s = read_trimmed(&dir.join("device_type"));
                if s.is_empty() {
                    "Razer USB Device".to_string()
                } else {
                    s
                }
            };
            let (dev_type, label_en, label_mn) = if drv.contains("kbd") {
                ("keyboard", "Keyboard", "Гар")
            } else if drv.contains("mouse") {
                ("mouse", "Wireless Mouse", "Утасгүй хулгана")
            } else if drv.contains("headset") {
                ("headset", "Headset", "Чихэвч")
            } else {
                infer_type(drv, &model, "Device")
            };
            let conn = if charging_state == "charging" || model.to_lowercase().contains("wired") {
                "wired_usb"
            } else {
                "usb_dongle_2_4ghz"
            };
            out.push(make_device_dto(
                out.len(),
                dev_type,
                label_en,
                label_mn,
                &model,
                pct,
                charging_state,
                conn,
                "razer_openrazer",
            ));
        }
    }
    out
}

#[cfg(target_os = "linux")]
fn probe_headsetcontrol() -> Vec<PeripheralDeviceDto> {
    let Ok(output) = std::process::Command::new("headsetcontrol")
        .args(["-b", "-o", "json"])
        .output()
    else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }
    let Ok(json) = serde_json::from_slice::<serde_json::Value>(&output.stdout) else {
        return Vec::new();
    };
    let Some(items) = json.get("devices").and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for item in items {
        let Some(bat) = item.get("battery") else {
            continue;
        };
        let status = bat
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_uppercase();
        let Some(level) = bat.get("level").and_then(|v| v.as_i64()) else {
            continue;
        };
        if status == "BATTERY_UNAVAILABLE" || !(0..=100).contains(&level) {
            continue;
        }
        let charging_state = if status == "BATTERY_CHARGING" {
            "charging"
        } else if level >= 100 {
            "full"
        } else {
            "discharging"
        };
        let conn = if charging_state == "charging" {
            "wired_usb"
        } else {
            "usb_dongle_2_4ghz"
        };
        let model = item
            .get("device")
            .and_then(|v| v.as_str())
            .unwrap_or("USB Headset");
        out.push(make_device_dto(
            out.len(),
            "headset",
            "Headset",
            "Чихэвч",
            model,
            level as u8,
            charging_state,
            conn,
            "steelseries_hid",
        ));
    }
    out
}

#[cfg(target_os = "linux")]
fn extract_vid_from_hid_id(hid_id: &str) -> String {
    let mut parts = hid_id.split(':');
    let _bus = parts.next();
    let Some(vid_raw) = parts.next() else {
        return String::new();
    };
    let trimmed = vid_raw.trim_start_matches('0');
    format!("{:0>4}", trimmed).to_lowercase()
}

#[cfg(target_os = "linux")]
fn is_known_peripheral_vid(vid: &str) -> bool {
    matches!(
        vid,
        "046d"
            | "1532"
            | "1038"
            | "0951"
            | "1b1c"
            | "3434"
            | "3554"
            | "3710"
            | "258a"
            | "054c"
            | "045e"
            | "2dc8"
            | "248a"
            | "1ea7"
            | "31e3"
            | "0b05"
            | "25a7"
            | "0c45"
    )
}

#[cfg(target_os = "linux")]
fn probe_usb_hidraw() -> Vec<PeripheralDeviceDto> {
    let base = Path::new("/sys/class/hidraw");
    let Ok(entries) = fs::read_dir(base) else {
        return Vec::new();
    };
    let mut seen_ports: Vec<String> = Vec::new();
    let mut out: Vec<PeripheralDeviceDto> = Vec::new();

    let names = usb_identity::lsusb_names();
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|entry| {
        let (number, kind) = usb_identity::interface(&entry.path().join("device"));
        (kind.is_none(), number)
    });
    for entry in entries {
        if out.len() >= 8 {
            break;
        }
        let uevent = read_trimmed(&entry.path().join("device/uevent"));
        if uevent.is_empty() {
            continue;
        }
        let hid_phys = uevent_value(&uevent, "HID_PHYS");
        let phys_lower = hid_phys.trim().to_lowercase();
        if !phys_lower.starts_with("usb-") {
            continue;
        }
        let mut hid_name = uevent_value(&uevent, "HID_NAME");
        let (_, input_type) = usb_identity::interface(&entry.path().join("device"));
        if hid_name.is_empty() {
            let id = uevent_value(&uevent, "HID_ID");
            let key = id
                .split(':')
                .skip(1)
                .map(|part| {
                    part.chars()
                        .rev()
                        .take(4)
                        .collect::<String>()
                        .chars()
                        .rev()
                        .collect::<String>()
                        .to_lowercase()
                })
                .collect::<Vec<_>>()
                .join(":");
            hid_name = names.get(&key).cloned().unwrap_or_default();
        }
        let name_lower = hid_name.trim().to_lowercase();
        if name_lower.contains("hub")
            || name_lower.contains("webcam")
            || name_lower.contains("camera")
            || name_lower.contains("fingerprint")
            || name_lower.contains("touchscreen")
            || name_lower.contains("fido")
            || name_lower.contains("yubikey")
            || name_lower.contains("u2f")
        {
            continue;
        }

        let hid_id = uevent_value(&uevent, "HID_ID");
        let vid = extract_vid_from_hid_id(&hid_id);
        let name_looks_peripheral = name_lower.contains("2.4g")
            || name_lower.contains("wireless")
            || name_lower.contains("dongle")
            || name_lower.contains("receiver")
            || name_lower.contains("lightspeed")
            || name_lower.contains("unifying")
            || name_lower.contains("bolt")
            || name_lower.contains("slipstream")
            || name_lower.contains("mouse")
            || name_lower.contains("keyboard")
            || name_lower.contains("headset")
            || name_lower.contains("headphone")
            || name_lower.contains("gamepad")
            || name_lower.contains("controller")
            || name_lower.contains("gaming")
            || name_lower.contains("logitech")
            || name_lower.contains("razer")
            || name_lower.contains("steelseries")
            || name_lower.contains("hyperx")
            || name_lower.contains("corsair")
            || name_lower.contains("keychron")
            || name_lower.contains("vxe")
            || name_lower.contains("attack")
            || name_lower.contains("mchose")
            || name_lower.contains("rapoo")
            || name_lower.contains("pulsar")
            || name_lower.contains("glorious");

        if input_type.is_none() && !is_known_peripheral_vid(&vid) && !name_looks_peripheral {
            continue;
        }

        let port_prefix = phys_lower.split("/input").next().unwrap_or(&phys_lower);
        let port_key = format!("{}|{}", port_prefix, hid_id.to_lowercase());
        if seen_ports.iter().any(|k| k == &port_key) {
            continue;
        }
        seen_ports.push(port_key.clone());

        let (dev_type, label_en, label_mn) = match input_type {
            Some("keyboard") => ("keyboard", "Keyboard", "Гар"),
            Some("mouse") => ("mouse", "Mouse", "Хулгана"),
            _ => infer_type(&hid_name, &hid_name, "Device"),
        };
        let is_wireless_dongle = name_lower.contains("2.4g")
            || name_lower.contains("wireless")
            || name_lower.contains("dongle")
            || name_lower.contains("receiver")
            || name_lower.contains("lightspeed")
            || name_lower.contains("unifying")
            || name_lower.contains("bolt")
            || name_lower.contains("slipstream");
        let conn = if is_wireless_dongle {
            "usb_dongle_2_4ghz"
        } else {
            "wired_usb"
        };
        let driver = if vid == "046d" || name_lower.contains("logitech") {
            "hidpp"
        } else if vid == "1532" || name_lower.contains("razer") {
            "razer_openrazer"
        } else {
            "upower_generic"
        };
        let display_name = if hid_name.trim().is_empty() {
            "USB 2.4GHz Device"
        } else {
            hid_name.trim()
        };

        let mut dto = make_device_dto(
            out.len(),
            dev_type,
            label_en,
            label_mn,
            display_name,
            0,
            "unknown",
            conn,
            driver,
        );
        dto.battery_available = false;
        dto.device_id = Some(format!("usb:{}", port_key));
        out.push(dto);
    }
    out
}

#[cfg(target_os = "linux")]
fn merge_linux_devices(merged: &mut Vec<PeripheralDeviceDto>, extra: Vec<PeripheralDeviceDto>) {
    for dev in extra {
        if merged.len() >= 8 {
            break;
        }
        if !dev.battery_available {
            let covered = merged.iter().any(|ex| {
                ex.battery_available
                    && ((ex.device_id.is_some() && ex.device_id == dev.device_id)
                        || (ex.connection_type == dev.connection_type
                            && !is_generic_label(&ex.label_en)
                            && ex.label_en == dev.label_en))
            });
            if covered {
                continue;
            }
            let mut next = dev;
            next.slot_id = format!("slot_{}", merged.len() + 1);
            merged.push(next);
            continue;
        }

        if let Some(ex) = merged.iter_mut().find(|ex| {
            if let (Some(a), Some(b)) = (&ex.device_id, &dev.device_id) {
                return a == b;
            }
            ex.battery_available
                && ex.device_type == dev.device_type
                && ex.battery_pct.abs_diff(dev.battery_pct) <= 2
                && (ex.device_type == "laptop" || ex.connection_type == dev.connection_type)
                && (is_generic_label(&ex.label_en)
                    || is_generic_label(&dev.label_en)
                    || ex.label_en == dev.label_en)
        }) {
            if ex.device_id.is_none() {
                ex.device_id = dev.device_id.clone();
            }
            if is_generic_label(&ex.label_en) && !is_generic_label(&dev.label_en) {
                ex.label_en = dev.label_en;
                ex.label_mn = dev.label_mn;
            }
            continue;
        }
        let mut next = dev;
        next.slot_id = format!("slot_{}", merged.len() + 1);
        merged.push(next);
    }
}

#[cfg(target_os = "linux")]
pub fn linux_hardware_signature() -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Ok(entries) = fs::read_dir("/sys/class/power_supply") {
        for entry in entries.flatten() {
            let dir = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let cap = read_trimmed(&dir.join("capacity"));
            let st = read_trimmed(&dir.join("status"));
            let on = read_trimmed(&dir.join("online"));
            parts.push(format!("p:{}:{}:{}:{}", name, cap, st, on));
        }
    }
    if let Ok(entries) = fs::read_dir("/sys/class/hidraw") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            parts.push(format!("h:{}", name));
        }
    }
    parts.sort();
    parts.join("|")
}

#[cfg(not(target_os = "linux"))]
pub fn linux_hardware_signature() -> String {
    String::new()
}

#[cfg(target_os = "linux")]
pub fn probe_linux_snapshot() -> (bool, Vec<PeripheralDeviceDto>) {
    let (sys_charger, mut merged) = probe_sysfs();
    let (up_charger, up_devs) = probe_upower();
    let razer_devs = probe_openrazer_sysfs();
    let headset_devs = probe_headsetcontrol();
    let usb_hidraw_devs = probe_usb_hidraw();

    merge_linux_devices(&mut merged, up_devs);
    merge_linux_devices(&mut merged, razer_devs);
    merge_linux_devices(&mut merged, headset_devs);
    merge_linux_devices(&mut merged, usb_hidraw_devs);
    kairpods::enrich(&mut merged, kairpods::probe());
    m220::enrich(&mut merged);

    let any_charging = merged
        .iter()
        .any(|d| d.battery_available && d.charging_state == "charging");
    (
        sys_charger || up_charger || any_charging,
        device_groups::apply(merged),
    )
}

#[cfg(target_os = "linux")]
#[allow(dead_code)]
pub fn probe_peripherals() -> Vec<PeripheralDeviceDto> {
    probe_linux_snapshot().1
}

#[cfg(not(target_os = "linux"))]
pub fn probe_linux_snapshot() -> (bool, Vec<PeripheralDeviceDto>) {
    let devs = probe_peripherals();
    let charging = devs.iter().any(|d| d.charging_state == "charging");
    (charging, devs)
}

#[cfg(target_os = "windows")]
pub fn probe_peripherals() -> Vec<PeripheralDeviceDto> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let mut devices: Vec<PeripheralDeviceDto> = Vec::new();

    // Single hidden PowerShell invocation reads system batteries, design health, and PnP peripherals.
    let ps_script = r#"
      $sys = @(Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | ForEach-Object {
        [PSCustomObject]@{
          Pct = [int]$_.EstimatedChargeRemaining
          Status = [int]$_.BatteryStatus
        }
      })
      $healthPct = $null
      try {
        $static = Get-CimInstance -Namespace root\wmi -ClassName BatteryStaticData -ErrorAction SilentlyContinue | Select-Object -First 1
        $full = Get-CimInstance -Namespace root\wmi -ClassName BatteryFullChargedCapacity -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($static -and $full -and $static.DesignedCapacity -gt 0 -and $full.FullChargedCapacity -gt 0) {
          $healthPct = [Math]::Min(100, [Math]::Max(1, [int][Math]::Round(($full.FullChargedCapacity / $static.DesignedCapacity) * 100)))
        }
      } catch {}
      $pnp = @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | ForEach-Object {
        $prop = Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2' -ErrorAction SilentlyContinue
        if ($prop -and $prop.Data -ne $null) {
          [PSCustomObject]@{
            Name = $_.FriendlyName
            Battery = [int]$prop.Data
            InstanceId = $_.InstanceId
          }
        }
      })
      [PSCustomObject]@{ System = $sys; HealthPct = $healthPct; Pnp = $pnp } | ConvertTo-Json -Depth 4 -Compress
    "#;

    let Ok(out_res) = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", ps_script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    else {
        return devices;
    };

    if !out_res.status.success() {
        return devices;
    }

    let raw = String::from_utf8_lossy(&out_res.stdout).trim().to_string();
    let Ok(root) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return devices;
    };

    let sys_health = root
        .get("HealthPct")
        .and_then(|v| v.as_u64())
        .map(|h| h.clamp(1, 100) as u8);

    if let Some(sys_items) = root.get("System").and_then(|v| v.as_array()) {
        for item in sys_items {
            if devices.len() >= 8 {
                break;
            }
            if let Some(pct) = item.get("Pct").and_then(|v| v.as_u64()) {
                let status_code = item.get("Status").and_then(|v| v.as_u64()).unwrap_or(1);
                let charging_state = if status_code == 3 {
                    "full"
                } else if matches!(status_code, 2 | 6 | 7 | 8 | 9) {
                    "charging"
                } else {
                    "discharging"
                };
                let mut dto = make_device_dto(
                    devices.len(),
                    "laptop",
                    "System Battery",
                    "Компьютерын батарей",
                    "",
                    pct.min(100) as u8,
                    charging_state,
                    "wired_usb",
                    "upower_generic",
                );
                dto.battery_source = Some("Win32_Battery".to_string());
                if let Some(h) = sys_health {
                    dto.supports_health = true;
                    dto.health_pct = Some(h);
                }
                devices.push(dto);
            }
        }
    }

    if let Some(pnp_items) = root.get("Pnp").and_then(|v| v.as_array()) {
        for item in pnp_items {
            if devices.len() >= 8 {
                break;
            }
            let Some(fname) = item.get("Name").and_then(|v| v.as_str()) else {
                continue;
            };
            let Some(pct) = item.get("Battery").and_then(|v| v.as_u64()) else {
                continue;
            };
            let inst = item
                .get("InstanceId")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            let is_bt = inst.contains("bth") || has_bluetooth_token(fname);
            let conn = if is_bt {
                "bluetooth"
            } else {
                "usb_dongle_2_4ghz"
            };
            let driver = if is_bt {
                "standard_ble_bas"
            } else {
                "upower_generic"
            };
            let (dev_type, label_en, label_mn) = infer_type(fname, fname, "Device");
            let mut dto = make_device_dto(
                devices.len(),
                dev_type,
                label_en,
                label_mn,
                fname,
                pct.min(100) as u8,
                "discharging",
                conn,
                driver,
            );
            if !inst.is_empty() {
                dto.device_id = Some(format!("winpnp:{}", inst));
            }
            dto.battery_source = Some("Windows PnP".to_string());
            devices.push(dto);
        }
    }

    devices
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub fn probe_peripherals() -> Vec<PeripheralDeviceDto> {
    Vec::new()
}
