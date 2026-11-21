use super::PeripheralDeviceDto;

pub(super) fn apply(devices: Vec<PeripheralDeviceDto>) -> Vec<PeripheralDeviceDto> {
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join(".config")));
    let Some(base) = base else { return devices };
    let config = std::fs::read_to_string(base.join("app.volttray.monitor/device-pairs.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok());
    match config {
        Some(config) => group(devices, &config),
        None => devices,
    }
}

fn group(
    mut devices: Vec<PeripheralDeviceDto>,
    config: &serde_json::Value,
) -> Vec<PeripheralDeviceDto> {
    let Some(groups) = config["groups"].as_array() else {
        return devices;
    };
    for group in groups {
        let (Some(id), Some(name), Some(ids)) = (
            group["id"].as_str(),
            group["name"].as_str(),
            group["deviceIds"].as_array(),
        ) else {
            continue;
        };
        let matches = |d: &PeripheralDeviceDto| {
            d.device_id
                .as_ref()
                .is_some_and(|id| ids.iter().any(|v| v.as_str() == Some(id)))
        };
        let Some(index) = devices.iter().position(matches) else {
            continue;
        };
        let mut members: Vec<_> = devices.iter().filter(|d| matches(d)).cloned().collect();
        members.sort_by_key(|d| (!d.battery_available, d.connection_type != "wired_usb"));
        let mut combined = members[0].clone();
        combined.device_id = Some(format!("group:{}", id));
        combined.label_en = name.into();
        combined.label_mn = name.into();
        combined.connection_types = members.iter().map(|d| d.connection_type.clone()).collect();
        combined.connection_types.sort();
        combined.connection_types.dedup();
        devices.retain(|d| !matches(d));
        devices.insert(index, combined);
    }
    for (i, d) in devices.iter_mut().enumerate() {
        d.slot_id = format!("slot_{}", i + 1);
    }
    devices
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_explicitly_paired_ids_are_grouped() {
        let mut cable = super::super::make_device_dto(
            0,
            "mouse",
            "Mouse",
            "Mouse",
            "Mouse",
            0,
            "unknown",
            "wired_usb",
            "other",
        );
        cable.device_id = Some("cable".into());
        cable.battery_available = false;
        let mut receiver = cable.clone();
        receiver.device_id = Some("receiver".into());
        receiver.connection_type = "usb_dongle_2_4ghz".into();
        receiver.battery_available = true;
        receiver.battery_pct = 64;
        let mut other = receiver.clone();
        other.device_id = Some("other".into());
        let config = serde_json::json!({"groups":[{"id":"mouse","name":"My Mouse","deviceIds":["cable","receiver"]}]});
        let result = group(vec![cable, receiver, other], &config);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].battery_pct, 64);
        assert_eq!(result[0].connection_types.len(), 2);
        assert_eq!(result[1].device_id.as_deref(), Some("other"));
    }
}
