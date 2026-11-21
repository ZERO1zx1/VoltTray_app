use serde::{Deserialize, Serialize};
#[cfg(any(target_os = "linux", target_os = "windows", target_os = "macos"))]
use std::process::{Command, Stdio};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationRequestDto {
    pub action: String,
    pub title: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationResultDto {
    pub ok: bool,
    pub applied_to_hardware: bool,
    pub backend: String,
    pub message_en: String,
    pub message_mn: String,
}

#[cfg(target_os = "linux")]
fn cmd_exists(cmd: &str) -> bool {
    Command::new("which")
        .arg(cmd)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg_attr(not(any(target_os = "linux", test)), allow(dead_code))]
fn build_linux_notify_args<'a>(title: &'a str, body: &'a str) -> [&'a str; 7] {
    ["-a", "VoltTray", "-u", "normal", "--", title, body]
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
fn escape_xml(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            '\r' | '\n' => out.push(' '),
            other => out.push(other),
        }
    }
    out
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
fn escape_ps_single_quoted(input: &str) -> String {
    input.replace('\'', "''").replace(['\r', '\n'], " ")
}

#[cfg_attr(not(any(target_os = "windows", test)), allow(dead_code))]
fn build_windows_toast_script(title: &str, body: &str) -> String {
    let xml_title = escape_ps_single_quoted(&escape_xml(title));
    let xml_body = escape_ps_single_quoted(&escape_xml(body));
    format!(
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; \
         [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null; \
         $xml = New-Object Windows.Data.Xml.Dom.XmlDocument; \
         $xml.LoadXml('<toast><visual><binding template=\"ToastGeneric\"><text>{xml_title}</text><text>{xml_body}</text></binding></visual></toast>'); \
         $toast = New-Object Windows.UI.Notifications.ToastNotification $xml; \
         $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('app.volttray.monitor'); \
         $notifier.Show($toast)"
    )
}

#[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
fn escape_applescript_string(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace(['\r', '\n'], " ")
}

pub fn send_native_notification(title: &str, body: &str) -> Option<&'static str> {
    #[cfg(target_os = "linux")]
    {
        if !cmd_exists("notify-send") {
            return None;
        }
        let title_owned = title.to_string();
        let body_owned = body.to_string();
        // Spawn and reap on a dedicated background thread so the Tauri command thread never blocks
        // and no zombie child processes accumulate.
        std::thread::spawn(move || {
            let args = build_linux_notify_args(&title_owned, &body_owned);
            let _ = Command::new("notify-send")
                .args(args)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        });
        Some("notify-send")
    }

    #[cfg(target_os = "windows")]
    {
        let script = build_windows_toast_script(title, body);
        // Dispatch a native WinRT Toast notification (no NotifyIcon, no Start-Sleep, no orphan tray icon)
        // and reap the short-lived PowerShell process on a background thread.
        std::thread::spawn(move || {
            let _ = Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                .creation_flags(CREATE_NO_WINDOW)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        });
        Some("windows_winrt_toast")
    }

    #[cfg(target_os = "macos")]
    {
        let safe_title = escape_applescript_string(title);
        let safe_body = escape_applescript_string(body);
        let script = format!("display notification \"{safe_body}\" with title \"{safe_title}\"");
        std::thread::spawn(move || {
            let _ = Command::new("osascript")
                .args(["-e", &script])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        });
        Some("macos_osascript")
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        let _ = (title, body);
        None
    }
}

pub fn execute_notification_action(req: NotificationRequestDto) -> NotificationResultDto {
    if req.action == "send_low_battery_alert" {
        let title = req.title.unwrap_or_else(|| "Low Battery".to_string());
        let body = req
            .body
            .unwrap_or_else(|| "Please connect charger.".to_string());
        if let Some(backend) = send_native_notification(&title, &body) {
            return NotificationResultDto {
                ok: true,
                applied_to_hardware: true,
                backend: backend.to_string(),
                message_en: "Sent native desktop notification".to_string(),
                message_mn: "Системийн мэдэгдэл илгээлээ".to_string(),
            };
        }
    }

    NotificationResultDto {
        ok: false,
        applied_to_hardware: false,
        backend: "unavailable".to_string(),
        message_en: "Notification backend unavailable on this system".to_string(),
        message_mn: "Энэ систем дээр мэдэгдлийн үйлчилгээ олдсонгүй".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linux_notify_args_include_double_dash_separator() {
        let args = build_linux_notify_args("-weird title", "--body");
        assert_eq!(args[4], "--");
        assert_eq!(args[5], "-weird title");
        assert_eq!(args[6], "--body");
    }

    #[test]
    fn windows_toast_script_escapes_xml_and_quotes() {
        let script = build_windows_toast_script("O'Malley <15%>", "Plug & \"charge\"\nnow");
        assert!(!script.contains("NotifyIcon"));
        assert!(!script.contains("Start-Sleep"));
        assert!(script.contains("&lt;15%&gt;"));
        assert!(script.contains("&amp;"));
        assert!(script.contains("O&apos;Malley"));
        assert!(!script.contains('\n'));
    }

    #[test]
    fn applescript_escaping_handles_quotes_and_backslashes() {
        let escaped = escape_applescript_string("Test \"A\\B\"\nline");
        assert_eq!(escaped, "Test \\\"A\\\\B\\\" line");
    }
}
