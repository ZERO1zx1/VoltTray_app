# Changelog

## [1.0.0] - 2026-11-21

### Added
- Native `400 × 480` Tauri v2 desktop tray popup with dedicated Preferences panel (`EN` / `MN`, low-battery alerts, `10% / 15% / 20%` threshold, launch at login, keep on top).
- Rust background low-battery daemon with `+5%` recharge hysteresis so native desktop notifications fire even when the tray popup is hidden.
- Real battery design health (`%`) detection via Linux `sysfs` (`energy_full / energy_full_design`) and Windows WMI (`BatteryFullChargedCapacity / BatteryStaticData`).
- Cross-platform CLI installer (`scripts/cli.mjs` — `doctor`, `install`, `uninstall`, `--dry-run`, `--lang en|mn`) plus one-line `scripts/install.sh` (Linux) and `scripts/install.ps1` (Windows).
- Lightweight, 100% original `landing/` site (32 KB) aligned with the desktop app's visual system.
- Multi-resolution VoltTray application icons (`32x32`, `128x128`, `256x256`, `512x512`, and multi-size `.ico`).
- MIT `LICENSE`, GitHub Actions `ci.yml`, and tag-triggered `release.yml`.

### Changed
- Reorganized repository into a clean Tauri + React structure (`src/components/`, `src/lib/`, `src/server/`, `src-tauri/src/`).
- Merged Windows PowerShell probing into a single hidden (`CREATE_NO_WINDOW`) invocation.
- Guarded `state.json` persistence with `settingsEqual` to stop periodic disk writes on hardware poll ticks.

### Security
- Removed broad `99-volttray-peripherals.rules` udev rule; retained strictly scoped `70-volttray-m220.rules` (`bInterfaceNumber=02` only).
- Enforced strict read-only operation (removed legacy RGB/DPI/audio write paths and telemetry code).
- Removed outbound font requests from desktop `index.html` to honor offline Tauri CSP (`font-src 'self'`).
