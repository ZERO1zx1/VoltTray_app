# VoltTray — Төслийн бүрэн контекст (`context.md`)

* **Репозитор:** [ZERO1zx1/VoltTray](https://github.com/ZERO1zx1/volttray) (`main` салбар, Public)
* **Хувилбар / Таних нэр:** `v1.0.0` · `app.volttray.monitor` ([tauri.conf.json](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/tauri.conf.json))
* **Сүүлд шалгасан огноо:** 2026-11-21
* **Сүүлийн commit-ууд:** `f9c87af` (2026-11-21 — *"Add project context docs and VoltTray landing page"*), `e103c12` (2026-11-14 — *"Initial commit: VoltTray battery tray app for Windows and Linux"*) ([Commits](https://github.com/ZERO1zx1/VoltTray/commits/main/))

## 1. Төслийн зорилго ба үндсэн зарчим

VoltTray нь Windows болон Linux дээр system tray-д ажиллаж, компьютер болон утастай/утасгүй төхөөрөмжүүдийн (хулгана, гар, чихэвч, AirPods, контроллер зэрэг) батарейн түвшин, цэнэглэгчийн төлөвийг харуулдаг локал desktop апп юм ([VoltTray](https://github.com/ZERO1zx1/volttray)).

* **Local-first дизайн:** Бүх hardware өгөгдөл, хэрэглэгчийн тохиргоо болон зөвшөөрсөн telemetry зөвхөн локал төхөөрөмж дээр хадгалагдана; Gemini API key эсвэл гадаад cloud backend шаардахгүй ([VoltTray](https://github.com/ZERO1zx1/volttray)).
* **Хоёр хэлний дэмжлэг:** Интерфэйс болон төхөөрөмжийн нэршил нь англи (`en`) болон монгол (`mn`) хэлтэй ([types.ts](https://github.com/ZERO1zx1/VoltTray/blob/main/src/shared/types.ts), [i18n.ts](https://github.com/ZERO1zx1/VoltTray/blob/main/src/shared/i18n.ts)).
* **Read-only hardware зарчим:** Төхөөрөмжүүдийн DPI, RGB, товч тохируулга, firmware эсвэл Bluetooth хослолтыг өөрчлөхгүй — зөвхөн батарей болон холболтын төлөвийг уншина ([airpods.md](https://github.com/ZERO1zx1/VoltTray/blob/main/docs/airpods.md), [m220.md](https://github.com/ZERO1zx1/VoltTray/blob/main/docs/m220.md)).

## 2. Технологийн стек ба тохиргоо

| Давхарга | Технологи ба хувилбар | Эх сурвалж |
| :--- | :--- | :--- |
| **Frontend UI** | React `^19.0.1`, TypeScript `^7.0.2`, Vite `^8.3.0`, Tailwind CSS `^4.3.3`, `motion` `^12.23.24`, `lucide-react` `^0.546.0` | [package.json](https://github.com/ZERO1zx1/VoltTray/blob/main/package.json) |
| **Desktop Backend** | Tauri v2 (`tray-icon`), Rust (edition 2021), `serde`, `serde_json` (`lto = true`, `opt-level = "s"`, `strip = true`) | [Cargo.toml](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/Cargo.toml) |
| **Browser Dev Server** | Express `^4.21.2` + `tsx` `^4.21.0` (`127.0.0.1:3000`, dev үед Vite middleware, prod үед `dist/`) | [src/server/main.ts](https://github.com/ZERO1zx1/VoltTray/blob/main/src/server/main.ts) |
| **Цонх ба багцлалт** | `400x480`, `resizable: false`, `decorations: false`, `skipTaskbar: true`; багц: `nsis`, `msi`, `deb`, `appimage` | [tauri.conf.json](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/tauri.conf.json) |
| **Landing Page** | Build шаардахгүй статик HTML5 (`lang="mn"`) + модульчилсан CSS (`forest-pale-lime`, `Manrope` / `JetBrains Mono`) | [landing/index.html](https://github.com/ZERO1zx1/VoltTray/blob/main/landing/index.html) |

## 3. Архитектур ба хоёр Runtime загвар

Нэг React UI нь [desktopBridge.ts](https://github.com/ZERO1zx1/VoltTray/blob/main/src/platform/desktopBridge.ts)-ээр дамжуулан хоёр runtime дээр ажиллана ([architecture.md](https://github.com/ZERO1zx1/VoltTray/blob/main/docs/architecture.md)):

1. **Tauri v2 Desktop Runtime (`tauri_local`):**
   * Frontend нь `window.__TAURI_INTERNALS__.invoke`-оор [src-tauri/src/main.rs](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/src/main.rs) доторх 6 Rust IPC командыг дуудна: `get_local_bootstrap`, `save_local_state`, `set_autostart`, `set_widget_pinned`, `hide_widget`, `run_linux_hardware_action`.
   * Rust талд system tray icon, tooltip (`sync_tray_tooltip`), цонх хаах/нуух (`toggle_main_window`, хаахад tray-д үлдэнэ), болон background `SnapshotCache` ажиллана.
2. **Browser / Node Fallback Runtime (`127.0.0.1:3000`):**
   * [listen.ts](https://github.com/ZERO1zx1/VoltTray/blob/main/src/server/http/listen.ts) нь Express серверийг зөвхөн `127.0.0.1` локал интерфэйс дээр сонсгоно.
   * API замууд: `/api/health`, `/api/local/bootstrap`, `/api/local/stream` (1.5s SSE), `/api/local/state`, `/api/local/autostart`, `/api/local/action`, `/api/local/telemetry`, `/api/local/telemetry/reset` ([volttray_project_context.md](https://github.com/ZERO1zx1/VoltTray/blob/main/volttray_project_context.md)).

## 4. Хавтас ба файлын бүтэц

| Зам | Үүрэг ба гол агуулга | GitHub холбоос |
| :--- | :--- | :--- |
| `src/app/` | `App.tsx` (847 мөр tray popup UI) ба `styles.css` | [App.tsx](https://github.com/ZERO1zx1/VoltTray/blob/main/src/app/App.tsx) |
| `src/features/battery/` | `batteryMath.ts` (bucket тооцоолол), `deviceStatus.ts` (`deviceKey`, `hasBatteryReading`, `connectionBadge`), `DeviceIcon.tsx` + тестүүд | [battery/](https://github.com/ZERO1zx1/VoltTray/tree/main/src/features/battery) |
| `src/features/notifications/` | `OverlayToast.tsx` — цэнэг багассан үеийн overlay toast UI | [OverlayToast.tsx](https://github.com/ZERO1zx1/VoltTray/blob/main/src/features/notifications/OverlayToast.tsx) |
| `src/features/telemetry/` | `analyticsEngine.ts` + тест — consent guard, PII/хориглосон түлхүүр шүүлт, `alert_id`/`suggestion_id` холболт | [analyticsEngine.ts](https://github.com/ZERO1zx1/VoltTray/blob/main/src/features/telemetry/analyticsEngine.ts) |
| `src/platform/` | `desktopBridge.ts` — Tauri IPC болон Express HTTP/SSE нэгдсэн гүүр | [desktopBridge.ts](https://github.com/ZERO1zx1/VoltTray/blob/main/src/platform/desktopBridge.ts) |
| `src/shared/` | `types.ts` (`Locale`, `OsPlatform`, `DeviceType`, `ConnectionType`), `defaults.ts` (`INITIAL_SETTINGS`, `INITIAL_DEVICES`), `i18n.ts` | [shared/](https://github.com/ZERO1zx1/VoltTray/tree/main/src/shared) |
| `src/server/` | `main.ts`, `http/listen.ts`, `persistence/localStore.ts`, `hardware/` (`linuxProbe.ts`, `linuxControls.ts`, `deviceGroups.ts`, `providers/`) | [server/](https://github.com/ZERO1zx1/VoltTray/tree/main/src/server) |
| `src-tauri/src/` | `main.rs`, `autostart.rs`, `linux_controls.rs`, `hardware/` (`mod.rs`, `device_groups.rs`, `kairpods.rs`, `m220.rs`, `usb_identity.rs`) | [main.rs](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/src/main.rs) |
| `src-tauri/linux/` | `70-volttray-m220.rules`, `99-volttray-peripherals.rules` (Linux `hidraw` udev дүрмүүд) | [70-volttray-m220.rules](https://www.google.com/search?q=https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/linux/70-volttray-m220.rules) |
| `src-tauri/capabilities/` | `default.json` — `"main"` цонхонд зөвхөн `core:default`, `core:window:allow-start-dragging` | [default.json](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/capabilities/default.json) |
| `scripts/` | `test.mjs`, `clean.mjs`, `install-linux.sh`, `install-desktop.sh`, `install-m220-access.sh` | [scripts/](https://github.com/ZERO1zx1/VoltTray/tree/main/scripts) |
| `landing/` | 9 секцтэй (`hero`, `app-frame`, `alerts`, `features-2x2`, `statement`, `steps`, `privacy`, `faq`, `close`) статик landing page | [landing/](https://www.google.com/search?q=https://github.com/ZERO1zx1/VoltTray/tree/main/landing), [plan.md](https://www.google.com/search?q=https://github.com/ZERO1zx1/VoltTray/blob/main/landing/plan.md) |
| `docs/` | Архитектур, build, AirPods/M220/USB тайлбар, скан ба telemetry аудит, UX ба tracking баримтууд | [docs/](https://github.com/ZERO1zx1/VoltTray/tree/main/docs) |

## 5. Hardware Probing, Хадгалалт ба Аюулгүй байдал

### Hardware адаптерууд (`src-tauri/src/hardware/`)
* **Үндсэн probing ([mod.rs](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/src/hardware/mod.rs), 1166 мөр):** `PeripheralDeviceDto`, `BatteryComponent`, `HardwareSnapshot` бүтцээр төхөөрөмжүүдийн цэнэг, холболтын төрөл, слот болон `mn`/`en` нэршлийг цуглуулна.
* **AirPods ([kairpods.rs](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/src/hardware/kairpods.rs), 185 мөр):** Linux дээр ажиллаж буй `kAirPods` үйлчилгээнээс `busctl --user --json=short --timeout=1s --auto-start=no --allow-interactive-authorization=no call org.kairpods /org/kairpods/manager org.kairpods.manager GetDevices` дуудлагаар `left`, `right`, `case`, `headphone` цэнэгийг уншина. Нийт хувийг кейсийг хасан чихэвчний хамгийн бага (`min`) утгаар тооцно.
* **Valkyrie VK M3 Lite / M220 ([m220.rs](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/src/hardware/m220.rs), 181 мөр):** USB (`248a:5d2e`) болон 2.4GHz хүлээн авагч (`249a:5c2f`)-ийн interface `02` `/dev/hidraw*` руу `O_NONBLOCK`-оор 33 байтын `[0, 0x10, 0, ...]` хүсэлт илгээж, 32 байтын `M220` хариунаас цэнэг (`0..=100`) болон цэнэглэлтийг уншина. Хулганыг байнга сэрээхгүйн тулд үр дүнг `CACHE`-д 30 секунд хадгална.
* **USB танилт ([usb_identity.rs](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/src/hardware/usb_identity.rs), 45 мөр):** `sysfs` замын `bInterfaceSubClass`/`bInterfaceProtocol`-оос boot төхөөрөмжийг (`01/01` -> `keyboard`, `01/02` -> `mouse`) ялгаж, `lsusb` нэршилтэй холбоно ([usb-identification.md](https://github.com/ZERO1zx1/VoltTray/blob/main/docs/2026-11-15/usb-identification.md)).
* **Төхөөрөмжийн бүлэглэл ([device_groups.rs](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/src/hardware/device_groups.rs), 90 мөр):** `$XDG_CONFIG_HOME/app.volttray.monitor/device-pairs.json`-оос хосолсон төхөөрөмжүүдийг (`group:<id>`) нэгтгэж, `battery_available` болон `wired_usb` төлөвтэйг нь тэргүүнд эрэмбэлэн `slot_1..N` дугаарлана.

### Autostart, Мэдэгдэл ба udev эрх
* **Autostart ([autostart.rs](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/src/autostart.rs)):** Linux дээр `$XDG_CONFIG_HOME/autostart/volttray.desktop`, Windows дээр `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` түлхүүрт `"<зам>" --minimized` утгаар бичнэ/устгана.
* **Linux мэдэгдэл ([linux_controls.rs](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/src/linux_controls.rs)):** `send_low_battery_alert` үйлдэл дээр `notify-send` байвал `notify-send -a VoltTray -u normal` ажиллуулна; бусад үед `local_profile` төлөв буцаана.
* **udev дүрмүүд:** [70-volttray-m220.rules](https://www.google.com/search?q=https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/linux/70-volttray-m220.rules) (зөвхөн `bInterfaceNumber=="02"` дээр `uaccess`), [99-volttray-peripherals.rules](https://www.google.com/search?q=https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/linux/99-volttray-peripherals.rules) (Logitech, Razer, SteelSeries, Keychron, Corsair, Glorious, HyperX, Pulsar, Wooting, ASUS ROG, Sony, Microsoft Xbox — нийт 12 үйлдвэрлэгчийн `hidraw` дээр `MODE="0660", TAG+="uaccess"`).
* **Локал хадгалалт ба CSP:** [localStore.ts](https://github.com/ZERO1zx1/VoltTray/blob/main/src/server/persistence/localStore.ts) нь `.volttray/` (`0o700`), `state.json` (`0o600`, `.tmp` -> rename атомик бичилт), `telemetry.jsonl` (зөвхөн зөвшөөрсөн, `validatePayloadSafety` давсан бичлэгүүд)-ийг удирдана. Tauri CSP: `default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'` ([tauri.conf.json](https://github.com/ZERO1zx1/VoltTray/blob/main/src-tauri/tauri.conf.json)).

## 6. Командууд ба суулгалт

```bash
# Хамаарал суулгах (Node.js 20.19+ эсвэл 22.12+, Rust stable)
npm ci

# Хөгжүүлэлт (Desktop Tauri / Browser fallback 127.0.0.1:3000)
npm run tauri:dev
npm run dev

# Build ба цэвэрлэгээ
npm run build
npm run tauri:build
npm run clean

# Шалгалт ба тест
npm test
npm run lint
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline

# Linux udev ба desktop суулгалт
bash scripts/install-linux.sh
bash scripts/install-desktop.sh
bash scripts/install-m220-access.sh
```

Эх сурвалж: [package.json](https://github.com/ZERO1zx1/VoltTray/blob/main/package.json), [desktop-build.md](https://www.google.com/search?q=https://github.com/ZERO1zx1/VoltTray/blob/main/docs/desktop-build.md), [test.mjs](https://github.com/ZERO1zx1/VoltTray/blob/main/scripts/test.mjs), [install-linux.sh](https://github.com/ZERO1zx1/VoltTray/blob/main/scripts/install-linux.sh), [install-desktop.sh](https://github.com/ZERO1zx1/VoltTray/blob/main/scripts/install-desktop.sh), [install-m220-access.sh](https://github.com/ZERO1zx1/VoltTray/blob/main/scripts/install-m220-access.sh), [clean.mjs](https://github.com/ZERO1zx1/VoltTray/blob/main/scripts/clean.mjs).

## 7. Сканаар илэрсэн анхаарах зүйлс ба зөрүү

* **`context.md` ба `package.json`-ийн зөрүү:** Репозиторын хуучин [context.md](https://github.com/ZERO1zx1/VoltTray/blob/main/context.md) файлд `better-sqlite3` ашигладаг гэж бичсэн боловч бодит [package.json](https://github.com/ZERO1zx1/VoltTray/blob/main/package.json) дотор `better-sqlite3` байхгүй бөгөөд хадгалалт нь `LocalDiskStore`-оор атомик JSON/JSONL (`state.json`, `telemetry.jsonl`) хэлбэрээр ажиллаж байна ([localStore.ts](https://github.com/ZERO1zx1/VoltTray/blob/main/src/server/persistence/localStore.ts)).
* **Telemetry холболт бүрэн дуусаагүй:** [analyticsEngine.ts](https://github.com/ZERO1zx1/VoltTray/blob/main/src/features/telemetry/analyticsEngine.ts) нь consent guard, PII шүүлт, 26 нэгжийн тесттэй бэлэн боловч [telemetry-audit.md](https://github.com/ZERO1zx1/VoltTray/blob/main/docs/2026-11-15/telemetry-audit.md)-д тэмдэглэснээр Consent UI, frontend bridge, flush/transport, PostHog SDK болон `app_launched` event-тэй бүрэн холбогдоогүй байна.
* **CI/CD ба License байхгүй:** Репозиторт `LICENSE` файл болон GitHub Actions CI workflow хараахан нэмэгдээгүй байна ([context.md](https://github.com/ZERO1zx1/VoltTray/blob/main/context.md)).
* **Бүтцийн шилжилт:** 2026-11-15-нд хуучин хавтгай бүтцээс (`server.ts`, `src-tauri/src/hardware.rs`, `src/App.tsx`) feature-суурьтай бүтэц рүү шилжсэн ([structure-migration.md](https://www.google.com/search?q=https://github.com/ZERO1zx1/VoltTray/blob/main/docs/2026-11-15/structure-migration.md)).
