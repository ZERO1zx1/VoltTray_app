use super::read_trimmed;
use std::{collections::HashMap, path::Path};

pub(super) fn interface(path: &Path) -> (u8, Option<&'static str>) {
    let Ok(real) = path.canonicalize() else {
        return (255, None);
    };
    for parent in real.ancestors() {
        if parent.join("bInterfaceProtocol").exists() {
            let number = u8::from_str_radix(&read_trimmed(&parent.join("bInterfaceNumber")), 16)
                .unwrap_or(255);
            let kind = boot_type(
                &read_trimmed(&parent.join("bInterfaceSubClass")),
                &read_trimmed(&parent.join("bInterfaceProtocol")),
            );
            return (number, kind);
        }
    }
    (255, None)
}

fn boot_type(subclass: &str, protocol: &str) -> Option<&'static str> {
    if subclass != "01" {
        return None;
    }
    match protocol {
        "01" => Some("keyboard"),
        "02" => Some("mouse"),
        _ => None,
    }
}

pub(super) fn lsusb_names() -> HashMap<String, String> {
    let mut names = HashMap::new();
    let Ok(output) = std::process::Command::new("lsusb").output() else {
        return names;
    };
    if !output.status.success() {
        return names;
    }
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        if let Some((_, rest)) = line.split_once(" ID ") {
            if let Some((id, name)) = rest.split_once(' ') {
                names.insert(id.to_ascii_lowercase(), name.trim().to_string());
            }
        }
    }
    names
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn boot_protocol_distinguishes_keyboard_mouse_and_vendor_interfaces() {
        assert_eq!(boot_type("01", "01"), Some("keyboard"));
        assert_eq!(boot_type("01", "02"), Some("mouse"));
        assert_eq!(boot_type("00", "01"), None);
        assert_eq!(boot_type("01", "00"), None);
    }
}
