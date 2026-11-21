use serde::{Deserialize, Serialize};
#[cfg(any(target_os = "linux", target_os = "windows"))]
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareActionRequestDto {
    pub action: String,
    pub title: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareActionResultDto {
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
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn escape_ps_single_quoted(input: &str) -> String {
    input.replace('\'', "''").replace(['\r', '\n'], " ")
}

pub fn send_native_notification(title: &str, body: &str) -> Option<&'static str> {
    #[cfg(target_os = "linux")]
    {
        if cmd_exists("notify-send") {
            let ok = Command::new("notify-send")
                .args(["-a", "VoltTray", "-u", "normal", title, body])
                .status()
                .map(|s| s.success())
                .unwrap_or(false);
            if ok {
                return Some("notify-send");
            }
        }
        None
    }

    #[cfg(target_os = "windows")]
    {
        let safe_title = escape_ps_single_quoted(title);
        let safe_body = escape_ps_single_quoted(body);
        let script = format!(
            "Add-Type -AssemblyName System.Windows.Forms; \
             $n = New-Object System.Windows.Forms.NotifyIcon; \
             $n.Icon = [System.Drawing.SystemIcons]::Information; \
             $n.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Warning; \
             $n.BalloonTipTitle = '{safe_title}'; \
             $n.BalloonTipText = '{safe_body}'; \
             $n.Visible = $true; \
             $n.ShowBalloonTip(5000); \
             Start-Sleep -Milliseconds 500; \
             $n.Dispose()"
        );
        let ok = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if ok {
            Some("windows_notify_icon")
        } else {
            None
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        let _ = (title, body);
        None
    }
}

pub fn execute_linux_action(req: HardwareActionRequestDto) -> HardwareActionResultDto {
    if req.action == "send_low_battery_alert" {
        let title = req.title.unwrap_or_else(|| "Low Battery".to_string());
        let body = req
            .body
            .unwrap_or_else(|| "Please connect charger.".to_string());
        if let Some(backend) = send_native_notification(&title, &body) {
            return HardwareActionResultDto {
                ok: true,
                applied_to_hardware: true,
                backend: backend.to_string(),
                message_en: "Sent native desktop notification".to_string(),
                message_mn: "Системийн мэдэгдэл илгээлээ".to_string(),
            };
        }
    }

    HardwareActionResultDto {
        ok: true,
        applied_to_hardware: false,
        backend: "local_profile".to_string(),
        message_en: "Notification backend unavailable".to_string(),
        message_mn: "Мэдэгдлийн үйлчилгээ олдсонгүй".to_string(),
    }
}
