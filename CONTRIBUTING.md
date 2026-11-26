# Contributing to VoltTray

Thanks for helping improve VoltTray. Small, focused pull requests with clear test evidence are easiest to review.

## Prerequisites

- Node.js 20.19+ or 22.12+ and npm (CI uses Node.js 22).
- Rust stable and the Cargo toolchain.
- Linux desktop builds: WebKitGTK 4.1 development files, AppIndicator development files, librsvg, and patchelf (package names vary by distribution).
- Windows builds: a supported Visual Studio C++ build toolchain and WebView2 runtime.

## Local checks

~~~sh
npm ci
npm test
npm run typecheck
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
~~~

Run <code>npm run tauri:dev</code> for a desktop smoke check. Hardware-specific tests may require a connected device and are marked accordingly.

## Pull requests

- Explain the user-visible change and list the operating systems and checks you ran.
- Include a focused regression test for behavior changes.
- Add English and Mongolian translations for new UI messages.
- Update documentation when provider behavior or setup changes.
- Keep changes scoped and do not include local state, credentials, device identifiers, build output, or unrelated generated files.

## Non-negotiable project rules

- Hardware probing is strictly read-only. VoltTray must never write DPI, RGB, audio, firmware, Bluetooth pairing, or battery charge-limit settings.
- The desktop runtime has zero telemetry and no outbound analytics. Do not add analytics SDKs, tracking, or background network requests.
- Persist only the four user preferences: <code>locale</code>, <code>notificationsEnabled</code>, <code>lowBatteryThresholdPct</code>, and <code>launchAtLogin</code>.
- Preserve the offline Content Security Policy, minimal Tauri capabilities, and the hidden-at-startup 400 × 480 tray window.

See [supported device providers](docs/supported-devices.md) before adding a hardware adapter.
