use serde::{Deserialize, Serialize};
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

fn native_notification_command(title: &str, body: &str) -> Option<(&'static str, Command)> {
    #[cfg(target_os = "linux")]
    {
        if !cmd_exists("notify-send") {
            return None;
        }
        let mut command = Command::new("notify-send");
        command.args(build_linux_notify_args(title, body));
        Some(("notify-send", command))
    }

    #[cfg(target_os = "windows")]
    {
        let script = build_windows_toast_script(title, body);
        let mut command = Command::new("powershell");
        command
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW);
        Some(("windows_winrt_toast", command))
    }

    #[cfg(target_os = "macos")]
    {
        let safe_title = escape_applescript_string(title);
        let safe_body = escape_applescript_string(body);
        let script = format!("display notification \"{safe_body}\" with title \"{safe_title}\"");
        let mut command = Command::new("osascript");
        command.args(["-e", &script]);
        Some(("macos_osascript", command))
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        let _ = (title, body);
        None
    }
}

fn wait_for_notification(command: &mut Command, backend: &str) -> Result<(), String> {
    let status = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|error| format!("Could not run {backend}: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{backend} failed: {status}"))
    }
}

/// Keep the command alive until its child finishes; CLI callers exit immediately afterward.
pub fn send_native_notification_blocking(title: &str, body: &str) -> Result<&'static str, String> {
    let (backend, mut command) = native_notification_command(title, body)
        .ok_or_else(|| "No supported notification backend is available.".to_string())?;
    wait_for_notification(&mut command, backend)?;
    Ok(backend)
}

pub fn send_native_notification(title: &str, body: &str) -> Option<&'static str> {
    let (backend, mut command) = native_notification_command(title, body)?;
    // The desktop runtime stays alive while this thread spawns and reaps the child.
    std::thread::spawn(move || {
        let _ = wait_for_notification(&mut command, backend);
    });
    Some(backend)
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

    #[cfg(any(unix, target_os = "windows"))]
    #[test]
    fn notification_dispatch_waits_and_reports_backend_failure() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let marker = std::env::temp_dir().join(format!("volttray-notify-{nonce}"));
        #[cfg(unix)]
        let mut command = {
            let mut command = Command::new("sh");
            command.args(["-c", "sleep 0.05; printf done > \"$1\"; exit 7", "sh"]);
            command.arg(&marker);
            command
        };
        #[cfg(target_os = "windows")]
        let mut command = {
            let mut command = Command::new("powershell");
            command.args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Start-Sleep -Milliseconds 50; Set-Content -LiteralPath $env:VOLTTRAY_NOTIFY_MARKER -Value done; exit 7",
            ]);
            command.env("VOLTTRAY_NOTIFY_MARKER", &marker);
            command
        };
        let result = wait_for_notification(&mut command, "test-backend");
        assert!(
            marker.exists(),
            "the child must finish before dispatch returns"
        );
        let _ = std::fs::remove_file(marker);
        assert!(result.unwrap_err().contains("test-backend failed"));
    }

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
