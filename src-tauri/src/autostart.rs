#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "linux")]
use std::path::PathBuf;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(target_os = "linux")]
fn autostart_desktop_path() -> Option<PathBuf> {
    let config_dir = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))?;
    Some(config_dir.join("autostart").join("volttray.desktop"))
}

pub fn is_autostart_enabled() -> bool {
    #[cfg(target_os = "linux")]
    {
        autostart_desktop_path()
            .map(|p| p.exists())
            .unwrap_or(false)
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "VoltTray",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        false
    }
}

fn current_app_executable() -> Result<String, String> {
    #[cfg(target_os = "linux")]
    if let Some(appimage) = std::env::var_os("APPIMAGE") {
        return Ok(PathBuf::from(appimage).to_string_lossy().to_string());
    }

    std::env::current_exe()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|error| format!("Could not resolve VoltTray executable: {error}"))
}

#[cfg(target_os = "windows")]
fn remove_windows_autostart_value(key: &str) -> Result<(), String> {
    // Missing keys/values are already disabled; access and deletion errors must reach the UI.
    let script = r#"
      $ErrorActionPreference = 'Stop'
      try {
        $key = $env:VOLTTRAY_AUTOSTART_KEY
        if (Test-Path -LiteralPath $key) {
          $entry = Get-Item -LiteralPath $key
          if ($entry.GetValueNames() -contains 'VoltTray') {
            Remove-ItemProperty -LiteralPath $key -Name VoltTray
          }
        }
        exit 0
      } catch {
        [Console]::Error.WriteLine($_.Exception.Message)
        exit 1
      }
    "#;
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .env("VOLTTRAY_AUTOSTART_KEY", key)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| format!("Could not disable Windows startup: {error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "Could not disable Windows startup: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

pub fn set_autostart_enabled(enabled: bool) -> Result<bool, String> {
    #[cfg(target_os = "linux")]
    {
        let Some(path) = autostart_desktop_path() else {
            return Err("Could not resolve XDG autostart directory".to_string());
        };
        if enabled {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let exe = current_app_executable()?;
            let desktop_entry = format!(
                "[Desktop Entry]\nType=Application\nName=VoltTray\nComment=Local Battery & Charger Monitor\nExec=\"{}\" --minimized\nTerminal=false\nX-GNOME-Autostart-enabled=true\nCategories=Utility;System;\n",
                exe
            );
            fs::write(&path, desktop_entry).map_err(|e| e.to_string())?;
            Ok(true)
        } else {
            if path.exists() {
                fs::remove_file(&path).map_err(|e| e.to_string())?;
            }
            Ok(false)
        }
    }

    #[cfg(target_os = "windows")]
    {
        if enabled {
            let exe = current_app_executable()?;
            let cmd_val = format!("\"{}\" --minimized", exe);
            let status = std::process::Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "VoltTray",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &cmd_val,
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .map_err(|e| e.to_string())?;
            if !status.success() {
                return Err("Failed to add Windows startup registry key".to_string());
            }
            Ok(true)
        } else {
            remove_windows_autostart_value(r"HKCU:\Software\Microsoft\Windows\CurrentVersion\Run")?;
            Ok(false)
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        let _ = enabled;
        Ok(false)
    }
}

#[cfg(all(test, target_os = "windows"))]
mod windows_tests {
    use super::*;

    #[test]
    fn disabling_autostart_is_idempotent_and_preserves_other_registry_values() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let key = format!(r"HKCU:\Software\VoltTray-test-{nonce}");
        let run_script = |script: &str| {
            std::process::Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-Command", script])
                .env("VOLTTRAY_TEST_REGISTRY_KEY", &key)
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .unwrap()
        };
        let setup = run_script(
            "$ErrorActionPreference = 'Stop'; $key = $env:VOLTTRAY_TEST_REGISTRY_KEY; New-Item -Path $key -Force | Out-Null; New-ItemProperty -LiteralPath $key -Name VoltTray -Value test | Out-Null; New-ItemProperty -LiteralPath $key -Name Keep -Value other | Out-Null",
        );
        assert!(setup.status.success());
        let first = remove_windows_autostart_value(&key);
        let repeated = remove_windows_autostart_value(&key);
        let remaining = run_script(
            "$ErrorActionPreference = 'Stop'; $key = $env:VOLTTRAY_TEST_REGISTRY_KEY; (Get-Item -LiteralPath $key).GetValueNames(); Remove-Item -LiteralPath $key",
        );
        assert!(first.is_ok(), "{first:?}");
        assert!(repeated.is_ok(), "{repeated:?}");
        assert!(remaining.status.success());
        let names = String::from_utf8_lossy(&remaining.stdout);
        assert!(names.lines().any(|name| name.trim() == "Keep"));
        assert!(!names.lines().any(|name| name.trim() == "VoltTray"));
        assert!(remove_windows_autostart_value(&key).is_ok());
        assert!(remove_windows_autostart_value("").is_err());
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn appimage_autostart_uses_the_appimage_file_not_its_temporary_mount() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temp_dir = std::env::temp_dir().join(format!("volttray-autostart-{nonce}"));
        let appimage = temp_dir.join("VoltTray.AppImage");
        let config_dir = temp_dir.join("config");
        fs::create_dir_all(&temp_dir).unwrap();
        fs::write(&appimage, b"test image").unwrap();
        std::env::set_var("XDG_CONFIG_HOME", &config_dir);
        std::env::set_var("APPIMAGE", &appimage);

        set_autostart_enabled(true).unwrap();
        let entry_path = config_dir.join("autostart/volttray.desktop");
        let desktop_entry = fs::read_to_string(&entry_path).unwrap();
        let _ = set_autostart_enabled(false);
        std::env::remove_var("APPIMAGE");
        std::env::remove_var("XDG_CONFIG_HOME");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(
            desktop_entry.contains(&format!("Exec=\"{}\" --minimized", appimage.display())),
            "autostart must launch the stable AppImage file path: {desktop_entry}"
        );
    }
}
