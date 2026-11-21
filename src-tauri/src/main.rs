#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod autostart;
mod hardware;
mod notifications;

use autostart::{is_autostart_enabled, set_autostart_enabled};
use hardware::{linux_hardware_signature, probe_linux_snapshot, PeripheralDeviceDto};
use notifications::{
    execute_linux_action, send_native_notification, HardwareActionRequestDto,
    HardwareActionResultDto,
};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
#[cfg(target_os = "linux")]
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
#[cfg(target_os = "linux")]
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State, WindowEvent};

struct AlertSettings {
    locale: String,
    notifications_enabled: bool,
    low_battery_threshold_pct: u8,
}

impl Default for AlertSettings {
    fn default() -> Self {
        Self {
            locale: "mn".to_string(),
            notifications_enabled: true,
            low_battery_threshold_pct: 20,
        }
    }
}

struct SnapshotCache {
    initialized: bool,
    charger_connected: bool,
    devices: Vec<PeripheralDeviceDto>,
    last_signature: String,
    last_full_scan: Instant,
    notified_low_keys: HashSet<String>,
    alert_settings: AlertSettings,
}

impl Default for SnapshotCache {
    fn default() -> Self {
        Self {
            initialized: false,
            charger_connected: false,
            devices: Vec::new(),
            last_signature: String::new(),
            last_full_scan: Instant::now() - Duration::from_secs(60),
            notified_low_keys: HashSet::new(),
            alert_settings: AlertSettings::default(),
        }
    }
}

fn local_state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("volttray-state.json"))
}

fn load_alert_settings_from_disk(app: &AppHandle) -> AlertSettings {
    let mut cfg = AlertSettings::default();
    let Some(saved) = local_state_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
    else {
        return cfg;
    };
    if let Some(settings) = saved.get("settings") {
        if let Some(locale) = settings.get("locale").and_then(|v| v.as_str()) {
            if locale == "en" || locale == "mn" {
                cfg.locale = locale.to_string();
            }
        }
        if let Some(enabled) = settings.get("notificationsEnabled").and_then(|v| v.as_bool()) {
            cfg.notifications_enabled = enabled;
        }
        if let Some(threshold) = settings
            .get("lowBatteryThresholdPct")
            .and_then(|v| v.as_u64())
        {
            if matches!(threshold, 10 | 15 | 20) {
                cfg.low_battery_threshold_pct = threshold as u8;
            }
        }
    }
    cfg
}

fn device_alert_key(d: &PeripheralDeviceDto) -> String {
    d.device_id.clone().unwrap_or_else(|| {
        format!(
            "{}:{}:{}:{}",
            d.device_type, d.connection_type, d.label_en, d.slot_id
        )
    })
}

fn evaluate_background_low_battery(
    devices: &[PeripheralDeviceDto],
    settings: &AlertSettings,
    alerted: &mut HashSet<String>,
) -> Vec<(String, String)> {
    let mut to_notify = Vec::new();
    let is_mn = settings.locale == "mn";
    for dev in devices {
        if !dev.connected || !dev.battery_available {
            continue;
        }
        let key = device_alert_key(dev);
        if dev.charging_state == "charging"
            || dev.charging_state == "full"
            || dev.battery_pct > settings.low_battery_threshold_pct.saturating_add(5)
        {
            alerted.remove(&key);
            continue;
        }
        if !settings.notifications_enabled {
            continue;
        }
        if dev.battery_pct <= settings.low_battery_threshold_pct && !alerted.contains(&key) {
            alerted.insert(key);
            let name = if is_mn { &dev.label_mn } else { &dev.label_en };
            let title = format!("{} ({}%)", name, dev.battery_pct);
            let body = if is_mn {
                "Цэнэг бага байна — цэнэглэгчээ залгана уу."
            } else {
                "Low battery — connect your charger soon."
            };
            to_notify.push((title, body.to_string()));
        }
    }
    to_notify
}

fn sync_tray_tooltip(app: &AppHandle, charger_connected: bool, devices: &[PeripheralDeviceDto]) {
    if let Some(tray) = app.tray_by_id("volttray-main-tray") {
        let tooltip = if devices.is_empty() {
            if charger_connected {
                "VoltTray — Charger Plugged In".to_string()
            } else {
                "VoltTray — Battery & Charger".to_string()
            }
        } else {
            let summary: Vec<String> = devices
                .iter()
                .map(|d| {
                    if d.battery_available {
                        format!("{} {}%", d.label_en, d.battery_pct)
                    } else {
                        let transport = match d.connection_type.as_str() {
                            "bluetooth" => "BT",
                            "usb_dongle_2_4ghz" => "2.4GHz",
                            _ => "USB",
                        };
                        format!("{} ({})", d.label_en, transport)
                    }
                })
                .collect();
            format!("VoltTray — {}", summary.join(" · "))
        };
        let _ = tray.set_tooltip(Some(&tooltip));
    }
}

fn refresh_snapshot_cache(
    app: &AppHandle,
    cache_state: &Mutex<SnapshotCache>,
) -> (bool, Vec<PeripheralDeviceDto>) {
    let (charger_connected, devices) = probe_linux_snapshot();
    let sig = linux_hardware_signature();
    let notifications = if let Ok(mut guard) = cache_state.lock() {
        guard.initialized = true;
        guard.charger_connected = charger_connected;
        guard.devices = devices.clone();
        guard.last_signature = sig;
        guard.last_full_scan = Instant::now();
        let settings_clone = AlertSettings {
            locale: guard.alert_settings.locale.clone(),
            notifications_enabled: guard.alert_settings.notifications_enabled,
            low_battery_threshold_pct: guard.alert_settings.low_battery_threshold_pct,
        };
        evaluate_background_low_battery(&devices, &settings_clone, &mut guard.notified_low_keys)
    } else {
        Vec::new()
    };

    for (title, body) in notifications {
        let _ = send_native_notification(&title, &body);
    }

    sync_tray_tooltip(app, charger_connected, &devices);
    (charger_connected, devices)
}

#[tauri::command]
fn get_local_bootstrap(
    app: AppHandle,
    cache_state: State<'_, Mutex<SnapshotCache>>,
    force: Option<bool>,
) -> Value {
    let should_force = force.unwrap_or(false);
    let cached = if !should_force {
        cache_state
            .lock()
            .ok()
            .filter(|g| g.initialized)
            .map(|g| (g.charger_connected, g.devices.clone()))
    } else {
        None
    };

    let (charger_connected, devices) = match cached {
        Some(pair) => pair,
        None => refresh_snapshot_cache(&app, cache_state.inner()),
    };

    let saved = local_state_path(&app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<Value>(&s).ok());

    let settings = saved
        .as_ref()
        .and_then(|s| s.get("settings").cloned())
        .unwrap_or(Value::Null);

    serde_json::json!({
        "mode": "tauri_local",
        "os": if cfg!(target_os = "windows") { "windows" } else { "linux" },
        "chargerConnected": charger_connected,
        "autostartEnabled": is_autostart_enabled(),
        "probedHardwareCount": devices.len(),
        "settings": settings,
        "devices": devices
    })
}

#[tauri::command]
fn save_local_state(
    app: AppHandle,
    cache_state: State<'_, Mutex<SnapshotCache>>,
    payload: Value,
) -> Result<(), String> {
    let Some(path) = local_state_path(&app) else {
        return Ok(());
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    let text = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    fs::write(&tmp, text).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;

    if let Ok(mut guard) = cache_state.lock() {
        guard.alert_settings = load_alert_settings_from_disk(&app);
    }
    Ok(())
}

#[tauri::command]
fn set_autostart(enabled: bool) -> Result<bool, String> {
    set_autostart_enabled(enabled)
}

#[tauri::command]
fn set_widget_pinned(app: AppHandle, pinned: bool) -> Result<bool, String> {
    if let Some(win) = app.get_webview_window("main") {
        win.set_always_on_top(pinned).map_err(|e| e.to_string())?;
    }
    Ok(pinned)
}

#[tauri::command]
fn hide_widget(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

#[tauri::command]
fn run_linux_hardware_action(request: HardwareActionRequestDto) -> HardwareActionResultDto {
    execute_linux_action(request)
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let visible = win.is_visible().unwrap_or(false);
        if visible {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

fn main() {
    let start_minimized = std::env::args().any(|a| a == "--minimized");

    tauri::Builder::default()
        .manage(Mutex::new(SnapshotCache::default()))
        .setup(move |app| {
            // Hydrate alert settings before background threads run
            let persisted_alerts = load_alert_settings_from_disk(app.handle());
            if let Ok(mut guard) = app.state::<Mutex<SnapshotCache>>().lock() {
                guard.alert_settings = persisted_alerts;
            }

            // Enable auto-run on OS login on first run if no saved preference disables it
            let state_exists = local_state_path(app.handle())
                .map(|p| p.exists())
                .unwrap_or(false);
            if !state_exists && !is_autostart_enabled() {
                let _ = set_autostart_enabled(true);
            }

            if start_minimized {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                }
            }

            let show_item =
                MenuItem::with_id(app, "show", "Show / Hide Widget", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::with_id("volttray-main-tray")
                .menu(&menu)
                .tooltip("VoltTray — Battery & Charger")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => toggle_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }
            tray_builder.build(app)?;

            // Populate initial snapshot right away
            let initial_handle = app.handle().clone();
            std::thread::spawn(move || {
                let state = initial_handle.state::<Mutex<SnapshotCache>>();
                refresh_snapshot_cache(&initial_handle, state.inner());
            });

            // Real-time thread 1 (Linux): `upower --monitor` reacts immediately on device/charger changes
            #[cfg(target_os = "linux")]
            {
                let monitor_handle = app.handle().clone();
                std::thread::spawn(move || loop {
                    if let Ok(mut child) = Command::new("upower")
                        .arg("--monitor")
                        .stdout(Stdio::piped())
                        .stderr(Stdio::null())
                        .spawn()
                    {
                        if let Some(stdout) = child.stdout.take() {
                            let reader = BufReader::new(stdout);
                            for line_res in reader.lines() {
                                if line_res.is_err() {
                                    break;
                                }
                                let state = monitor_handle.state::<Mutex<SnapshotCache>>();
                                refresh_snapshot_cache(&monitor_handle, state.inner());
                            }
                        }
                        let _ = child.wait();
                    }
                    std::thread::sleep(Duration::from_secs(5));
                });
            }

            // Real-time thread 2: lightweight 1.5s sysfs/hidraw signature watcher + 30s fallback refresh
            let watch_handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_millis(1500));
                let state = watch_handle.state::<Mutex<SnapshotCache>>();
                let sig_now = linux_hardware_signature();
                let need_refresh = state
                    .lock()
                    .map(|g| {
                        !g.initialized
                            || (!sig_now.is_empty() && sig_now != g.last_signature)
                            || g.last_full_scan.elapsed() >= Duration::from_secs(30)
                    })
                    .unwrap_or(true);
                if need_refresh {
                    refresh_snapshot_cache(&watch_handle, state.inner());
                }
            });

            Ok(())
        })
        // Hide widget instead of exiting so background CPU/GPU remains near-zero in tray
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_local_bootstrap,
            save_local_state,
            set_autostart,
            set_widget_pinned,
            hide_widget,
            run_linux_hardware_action
        ])
        .run(tauri::generate_context!())
        .expect("error while running VoltTray");
}
