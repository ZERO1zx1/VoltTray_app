//! Headless command-line entry points. This module runs before Tauri initializes GTK/WebView.

use crate::autostart::{is_autostart_enabled, set_autostart_enabled};
use crate::hardware::{probe_linux_snapshot, PeripheralDeviceDto};
use crate::notifications::send_native_notification_blocking;
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::path::PathBuf;
#[cfg(target_os = "windows")]
use std::process::Command;

const DEFAULT_LOW_THRESHOLD: u8 = 20;

#[derive(Debug, PartialEq, Eq)]
enum CliCommand {
    Launch,
    Help,
    Version,
    Status { json: bool, low: bool },
    Autostart(AutostartAction),
    NotifyTest,
    Doctor,
}

#[derive(Debug, PartialEq, Eq)]
enum AutostartAction {
    On,
    Off,
    Status,
}

fn parse_args(args: &[String]) -> Result<CliCommand, String> {
    if args.is_empty() || args == ["--minimized"] {
        return Ok(CliCommand::Launch);
    }
    match args[0].as_str() {
        "--help" | "-h" if args.len() == 1 => Ok(CliCommand::Help),
        "--version" | "-V" if args.len() == 1 => Ok(CliCommand::Version),
        "status" => {
            let (mut output_json, mut low) = (false, false);
            for arg in &args[1..] {
                match arg.as_str() {
                    "--json" if !output_json => output_json = true,
                    "--low" if !low => low = true,
                    _ => return Err(format!("Unknown or repeated status option: {arg}")),
                }
            }
            if output_json && low {
                return Err("status options --json and --low cannot be combined".into());
            }
            Ok(CliCommand::Status {
                json: output_json,
                low,
            })
        }
        "autostart" if args.len() == 2 => match args[1].as_str() {
            "on" => Ok(CliCommand::Autostart(AutostartAction::On)),
            "off" => Ok(CliCommand::Autostart(AutostartAction::Off)),
            "status" => Ok(CliCommand::Autostart(AutostartAction::Status)),
            value => Err(format!("Unknown autostart action: {value}")),
        },
        "notify-test" if args.len() == 1 => Ok(CliCommand::NotifyTest),
        "doctor" if args.len() == 1 => Ok(CliCommand::Doctor),
        command => Err(format!("Unknown command or invalid arguments: {command}")),
    }
}

/// Return the per-user configuration path used by Tauri for the local state file.
fn local_state_path() -> Option<PathBuf> {
    let base = match env::consts::OS {
        "windows" => env::var_os("APPDATA").map(PathBuf::from),
        "macos" => env::var_os("HOME")
            .map(PathBuf::from)
            .map(|home| home.join("Library/Application Support")),
        _ => env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".config"))),
    }?;
    Some(
        base.join("app.volttray.monitor")
            .join("volttray-state.json"),
    )
}

fn configured_low_threshold() -> u8 {
    local_state_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|contents| serde_json::from_str::<Value>(&contents).ok())
        .and_then(|state| {
            state
                .get("settings")?
                .get("lowBatteryThresholdPct")?
                .as_u64()
        })
        .filter(|value| matches!(*value, 10 | 15 | 20))
        .map(|value| value as u8)
        .unwrap_or(DEFAULT_LOW_THRESHOLD)
}

fn is_low(device: &PeripheralDeviceDto, threshold: u8) -> bool {
    device.connected
        && device.battery_available
        && device.battery_pct <= threshold
        && !matches!(device.charging_state.as_str(), "charging" | "full")
}

fn connection_label(value: &str) -> &str {
    match value {
        "bluetooth" => "Bluetooth",
        "usb_dongle_2_4ghz" => "2.4 GHz",
        "wired_usb" => "USB",
        _ => "Unknown",
    }
}

fn charging_label(value: &str) -> &str {
    match value {
        "charging" => "Charging",
        "discharging" => "Discharging",
        "full" => "Full",
        "paused_limit" => "Paused at limit",
        _ => "Unknown",
    }
}

fn format_table(devices: &[PeripheralDeviceDto]) -> String {
    if devices.is_empty() {
        return "No battery devices detected.".into();
    }
    let name_width = devices
        .iter()
        .map(|device| device.label_en.chars().count())
        .max()
        .unwrap_or(6)
        .max("DEVICE".len());
    let mut lines = vec![format!(
        "{:<name_width$}  {:<12}  {:>7}  {:<16}  {:>6}",
        "DEVICE", "CONNECTION", "BATTERY", "STATE", "HEALTH"
    )];
    for device in devices {
        let battery = if device.battery_available {
            format!("{}%", device.battery_pct)
        } else {
            "—".into()
        };
        let health = device
            .health_pct
            .filter(|_| device.supports_health)
            .map(|value| format!("{value}%"))
            .unwrap_or_else(|| "—".into());
        lines.push(format!(
            "{:<name_width$}  {:<12}  {:>7}  {:<16}  {:>6}",
            device.label_en,
            connection_label(&device.connection_type),
            battery,
            charging_label(&device.charging_state),
            health
        ));
    }
    lines.join("\n")
}

fn hardware_snapshot() -> Value {
    let (charger_connected, devices) = probe_linux_snapshot();
    json!({ "chargerConnected": charger_connected, "devices": devices })
}

fn print_status_table(devices: &[PeripheralDeviceDto]) {
    if devices.is_empty() {
        println!("No battery devices detected.");
    } else {
        println!("{}", format_table(devices));
    }
}

fn command_exists(name: &str) -> bool {
    let Some(path) = env::var_os("PATH") else {
        return false;
    };
    env::split_paths(&path).any(|directory| {
        directory.join(name).is_file()
            || (env::consts::OS == "windows"
                && [".exe", ".cmd", ".bat"]
                    .iter()
                    .any(|extension| directory.join(format!("{name}{extension}")).is_file()))
    })
}

#[cfg(target_os = "windows")]
fn windows_wmi_query_ok() -> bool {
    Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-CimInstance -ClassName Win32_Battery -ErrorAction Stop | Out-Null",
        ])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(not(target_os = "windows"))]
fn windows_wmi_query_ok() -> bool {
    false
}

fn doctor() -> i32 {
    let mut has_failure = false;
    let mut check = |label: &str, state: &str, detail: &str, failure: bool| {
        println!("{state:<4} {label}: {detail}");
        has_failure |= failure;
    };
    match env::consts::OS {
        "linux" => {
            let upower = command_exists("upower");
            check(
                "UPower",
                if upower { "OK" } else { "WARN" },
                if upower {
                    "available"
                } else {
                    "not installed; sysfs providers may still work"
                },
                false,
            );
            let busctl = command_exists("busctl");
            check(
                "busctl / kAirPods",
                if busctl { "OK" } else { "WARN" },
                if busctl {
                    "busctl available; kAirPods service is optional"
                } else {
                    "busctl missing; kAirPods readings unavailable"
                },
                false,
            );
            let notify_send = command_exists("notify-send");
            check(
                "notify-send",
                if notify_send { "OK" } else { "WARN" },
                if notify_send {
                    "available"
                } else {
                    "missing; desktop notifications unavailable"
                },
                false,
            );
            let rule_installed = [
                "/usr/lib/udev/rules.d/70-volttray-m220.rules",
                "/etc/udev/rules.d/70-volttray-m220.rules",
            ]
            .iter()
            .any(|path| PathBuf::from(path).is_file());
            check(
                "M220 udev rule",
                if rule_installed { "OK" } else { "WARN" },
                if rule_installed {
                    "installed"
                } else {
                    "optional rule is not installed"
                },
                false,
            );
            let hidraw_devices: Vec<_> = fs::read_dir("/dev")
                .into_iter()
                .flatten()
                .flatten()
                .filter(|entry| entry.file_name().to_string_lossy().starts_with("hidraw"))
                .collect();
            let has_hidraw = !hidraw_devices.is_empty();
            let can_read_hidraw = hidraw_devices
                .iter()
                .any(|entry| fs::OpenOptions::new().read(true).open(entry.path()).is_ok());
            check(
                "hidraw permissions",
                if !has_hidraw || can_read_hidraw {
                    "OK"
                } else {
                    "WARN"
                },
                if !has_hidraw {
                    "no hidraw device is connected"
                } else if can_read_hidraw {
                    "at least one hidraw device is readable"
                } else {
                    "hidraw devices exist but are not readable by this user"
                },
                false,
            );
        }
        "windows" => {
            let powershell = command_exists("powershell");
            let wmi_ok = powershell && windows_wmi_query_ok();
            check(
                "PowerShell / WMI",
                if wmi_ok { "OK" } else { "FAIL" },
                if !powershell {
                    "PowerShell is required for Windows battery and PnP probes"
                } else if wmi_ok {
                    "PowerShell ran the Win32_Battery WMI query"
                } else {
                    "the Win32_Battery WMI query failed"
                },
                !wmi_ok,
            );
        }
        "macos" => check(
            "Battery provider",
            "WARN",
            "native hardware battery probing is not implemented on macOS",
            false,
        ),
        other => check("Platform", "FAIL", other, true),
    }
    match local_state_path() {
        Some(path) if path.exists() => match fs::read_to_string(&path) {
            Ok(_) => check(
                "Local state",
                "OK",
                "volttray-state.json is readable",
                false,
            ),
            Err(error) => check("Local state", "FAIL", &error.to_string(), true),
        },
        Some(_) => check("Local state", "OK", "not created yet", false),
        None => check(
            "Local state",
            "WARN",
            "configuration directory is unavailable",
            false,
        ),
    }
    if has_failure {
        1
    } else {
        0
    }
}

fn print_help() {
    println!(
        "VoltTray {}\n\
Usage: volttray [--minimized]\n\
Commands:\n\
  status [--json | --low]  Show detected battery devices\n\
  autostart [on|off|status]\n\
  notify-test              Send a test desktop notification\n\
  doctor                   Check provider and local-state availability\n\
  --version                Print version\n\
  --help                   Print this help",
        env!("CARGO_PKG_VERSION")
    );
}

/// Handle a headless subcommand. None means continue into the Tauri desktop app.
pub fn run(args: &[String]) -> Option<i32> {
    let command = match parse_args(args) {
        Ok(command) => command,
        Err(error) => {
            eprintln!("{error}\nRun volttray --help for usage.");
            return Some(2);
        }
    };
    match command {
        CliCommand::Launch => None,
        CliCommand::Help => {
            print_help();
            Some(0)
        }
        CliCommand::Version => {
            println!("VoltTray {}", env!("CARGO_PKG_VERSION"));
            Some(0)
        }
        CliCommand::Status { json: true, .. } => {
            println!(
                "{}",
                serde_json::to_string_pretty(&hardware_snapshot()).unwrap()
            );
            Some(0)
        }
        CliCommand::Status { low: true, .. } => {
            let threshold = configured_low_threshold();
            let devices = probe_linux_snapshot().1;
            let low: Vec<_> = devices
                .iter()
                .filter(|device| is_low(device, threshold))
                .cloned()
                .collect();
            if low.is_empty() {
                println!("No devices at or below {threshold}%.");
            } else {
                println!("{}", format_table(&low));
            }
            Some(if low.is_empty() { 0 } else { 1 })
        }
        CliCommand::Status { .. } => {
            let snapshot = hardware_snapshot();
            let devices = serde_json::from_value::<Vec<PeripheralDeviceDto>>(
                snapshot
                    .get("devices")
                    .cloned()
                    .unwrap_or_else(|| json!([])),
            )
            .unwrap_or_default();
            print_status_table(&devices);
            Some(0)
        }
        CliCommand::Autostart(AutostartAction::Status) => {
            println!(
                "Autostart: {}",
                if is_autostart_enabled() { "on" } else { "off" }
            );
            Some(0)
        }
        CliCommand::Autostart(action) => {
            let enabled = action == AutostartAction::On;
            match set_autostart_enabled(enabled) {
                Ok(actual) => {
                    println!("Autostart: {}", if actual { "on" } else { "off" });
                    Some(0)
                }
                Err(error) => {
                    eprintln!("Could not update autostart: {error}");
                    Some(1)
                }
            }
        }
        CliCommand::NotifyTest => match send_native_notification_blocking(
            "VoltTray notification test",
            "Native desktop notifications are available.",
        ) {
            Ok(backend) => {
                println!("Notification requested via {backend}.");
                Some(0)
            }
            Err(error) => {
                eprintln!("{error}");
                Some(1)
            }
        },
        CliCommand::Doctor => Some(doctor()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).into()).collect()
    }

    fn sample_device() -> PeripheralDeviceDto {
        PeripheralDeviceDto {
            device_id: Some("usb:m220-test".into()),
            battery_source: Some("M220 HID".into()),
            connection_types: Vec::new(),
            battery_components: Vec::new(),
            slot_id: "slot_1".into(),
            device_type: "mouse".into(),
            label_en: "VK M3 Lite".into(),
            label_mn: "VK M3 Lite".into(),
            battery_pct: 18,
            battery_available: true,
            charging_state: "discharging".into(),
            connection_type: "usb_dongle_2_4ghz".into(),
            connected: true,
            supports_health: true,
            health_pct: Some(91),
            protocol_driver: "m220_hid".into(),
        }
    }

    #[test]
    fn parses_cli_and_launch_arguments() {
        assert_eq!(parse_args(&args(&[])), Ok(CliCommand::Launch));
        assert_eq!(parse_args(&args(&["--minimized"])), Ok(CliCommand::Launch));
        assert_eq!(
            parse_args(&args(&["status", "--json"])),
            Ok(CliCommand::Status {
                json: true,
                low: false
            })
        );
        assert_eq!(
            parse_args(&args(&["autostart", "off"])),
            Ok(CliCommand::Autostart(AutostartAction::Off))
        );
        assert!(parse_args(&args(&["status", "--json", "--low"])).is_err());
        assert!(parse_args(&args(&["unknown"])).is_err());
    }

    #[test]
    fn formats_device_table_with_human_labels_and_health() {
        let table = format_table(&[sample_device()]);
        assert!(table.contains("VK M3 Lite"));
        assert!(table.contains("2.4 GHz"));
        assert!(table.contains("18%"));
        assert!(table.contains("Discharging"));
        assert!(table.contains("91%"));
    }

    #[test]
    fn formats_valid_json_snapshot() {
        let snapshot = json!({ "chargerConnected": true, "devices": [sample_device()] });
        let encoded = serde_json::to_string(&snapshot).unwrap();
        let decoded: Value = serde_json::from_str(&encoded).unwrap();
        assert_eq!(decoded["chargerConnected"], true);
        assert_eq!(decoded["devices"][0]["batteryPct"], 18);
        assert_eq!(decoded["devices"][0]["healthPct"], 91);
    }
}
