# VoltTray

Local-first, read-only system tray battery monitor for **Windows** and **Linux**, built with **Tauri v2 (Rust)**, **React 19**, **TypeScript**, and **Tailwind CSS v4**.

## What VoltTray Does

- **Unified tray popup (`400 × 480`)**: View laptop battery (with real design health % where supported), Bluetooth headphones (including AirPods Left / Right / Case breakdown via `kAirPods`), and 2.4GHz wireless peripherals in one click.
- **Background low-battery alerts**: Hysteresis-guarded (`+5%`) native desktop notifications run in the Rust daemon even when the popup window is hidden in the system tray.
- **Strictly read-only**: Never writes to DPI, RGB lighting, volume, or hardware charge limits.
- **Zero telemetry**: Saves only your 4 preferences (`locale`, `notificationsEnabled`, `lowBatteryThresholdPct`, `launchAtLogin`) locally in `state.json`.
- **Native English & Mongolian (`EN` / `MN`) UI**.

## Supported Hardware Providers

| Platform | Provider | Devices |
| --- | --- | --- |
| Linux | `/sys/class/power_supply` & `UPower` | System battery + health %, HID++ peripherals, Bluetooth BAS |
| Linux | `OpenRazer` sysfs & `HeadsetControl` | Supported Razer devices and wireless USB headsets |
| Linux | `kAirPods` D-Bus & `M220` HID | AirPods L/R/Case telemetry; Valkyrie VK M3 Lite 2.4GHz |
| Windows | `Win32_Battery`, WMI health & PnP `DEVPKEY` | System battery + health %, Windows BLE/HID devices |

## Linux Security Note (M220 udev Rule)

If you use a Valkyrie VK M3 Lite 2.4GHz receiver on Linux, `scripts/install-linux.sh` installs only the interface-scoped `src-tauri/linux/70-volttray-m220.rules` rule (restricted to `VID=0x3554`, `PID=0xfa09`, `bInterfaceNumber=02`). VoltTray intentionally does **not** grant broad hidraw access to keyboards or unrelated input devices.

## CLI Installer

**Linux (one-line installer from GitHub Releases):**

```bash
curl -fsSL https://raw.githubusercontent.com/ZERO1zx1/VoltTray_app/main/scripts/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/ZERO1zx1/VoltTray_app/main/scripts/install.ps1 | iex
```

**Cross-platform local CLI (`doctor`, `install`, `uninstall`, `--dry-run`, `--lang mn|en`):**

```bash
node scripts/cli.mjs doctor --lang mn
node scripts/cli.mjs install --dry-run --lang mn
npm run install:cli -- install --from-source --autostart
```

## Development & Build

Requires **Node.js 20+** and the **Rust / Tauri v2** toolchain.

```bash
npm install
npm test
npm run typecheck
npm run build
```

To run or bundle the native desktop app:

```bash
npm run tauri:dev
npm run tauri:build
```

## License

MIT — see [LICENSE](./LICENSE).
