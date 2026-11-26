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
            return (number, kind.or_else(|| input_mouse_type(&real)));
        }
    }
    (255, input_mouse_type(&real))
}

// Kernel input capabilities identify mice independently of brand or product name.
fn input_mouse_type(hid: &Path) -> Option<&'static str> {
    let entries = std::fs::read_dir(hid.join("input")).ok()?;
    entries
        .flatten()
        .any(|entry| {
            let caps = entry.path().join("capabilities");
            is_relative_pointer(&read_trimmed(&caps.join("rel")))
        })
        .then_some("mouse")
}

fn is_relative_pointer(bitmap: &str) -> bool {
    // sysfs prints most-significant words first; REL_X and REL_Y are bits 0/1.
    bitmap
        .split_whitespace()
        .last()
        .and_then(|word| u64::from_str_radix(word, 16).ok())
        .is_some_and(|bits| bits & 3 == 3)
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
    fn generic_relative_axes_do_not_depend_on_brand() {
        assert!(is_relative_pointer("103"));
        assert!(is_relative_pointer("0 3"));
        assert!(!is_relative_pointer("100"));
        assert!(!is_relative_pointer(""));
        assert!(!is_relative_pointer("invalid"));
    }

    #[test]
    fn boot_protocol_distinguishes_keyboard_mouse_and_vendor_interfaces() {
        assert_eq!(boot_type("01", "01"), Some("keyboard"));
        assert_eq!(boot_type("01", "02"), Some("mouse"));
        assert_eq!(boot_type("00", "01"), None);
        assert_eq!(boot_type("01", "00"), None);
    }
}
