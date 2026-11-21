# VoltTray_app — Bug Fix & UI/UX Improvement Prompt

You are working on **VoltTray** ([ZERO1zx1/VoltTray_app](https://github.com/ZERO1zx1/VoltTray_app)), a local-first, strictly read-only, zero-telemetry cross-platform (Windows & Linux) system tray battery monitor built with **Tauri v2 (Rust)**, **React 19**, **TypeScript**, **Vite**, and **Tailwind CSS v4**.

Inspect the codebase first to confirm exact line numbers and existing patterns, then implement the bug fixes and UI/UX improvements below cleanly and atomically.

## Guardrails (Do Not Break)
- Keep all hardware probing **strictly read-only** (never write DPI, RGB, audio, firmware, or charge-limit settings).
- Keep **zero telemetry** and persist only the 4 local settings (`locale`, `notificationsEnabled`, `lowBatteryThresholdPct`, `launchAtLogin`) in local `state.json`.
- Preserve `EN` and `MN` localization in `src/lib/i18n.ts` for any new user-facing copy (e.g., inline error banners).
- Preserve the `400x480` frameless tray popup geometry, minimal Tauri capabilities, and `default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'` CSP in `src-tauri/tauri.conf.json`.

## 1. Fix Critical Frontend State & IPC Bridge Bugs

### 1.1 Remove side effects from React state updaters (`src/DesktopApp.tsx`)
- Inspect `handleToggleAutostart`, `handleTogglePin`, and `handleToggleSample` (around lines 201–239).
- Refactor them so **no async IPC calls (`toggleOsAutostart`, `setWidgetPinned`, `loadLocalBootstrap`) and no nested `setState` calls (`setDevices`, `setLastUpdated`, `setSettings`) execute inside `setState((prev) => ...)` updater callbacks** (which double-fire in React StrictMode and cause race conditions).
- Compute the next boolean value outside the updater, apply the optimistic update cleanly, await the IPC call inside `try/catch`, and roll back to the previous state on failure.
- Add a lightweight, auto-dismissing (3–4s) inline error banner inside the `400x480` popup (with `EN`/`MN` strings) so failed autostart or hardware refresh operations surface clear feedback instead of failing silently.

### 1.2 Fix error swallowing & fragile IPC calls (`src/lib/desktopBridge.ts`)
- In `toggleOsAutostart`, do **not** swallow `invoke("set_autostart", ...)` errors by returning the requested `enabled` value in `catch`. Propagate the error (or return a typed result `{ ok: boolean; enabled: boolean; error?: string }`) so `DesktopApp.tsx` can roll back and notify the user.
- Replace direct `window.__TAURI_INTERNALS__!.invoke(...)` usage with the official `@tauri-apps/api/core` `invoke` (or a clean runtime-checked wrapper using the public Tauri v2 API).
- Rename the `run_linux_hardware_action` command used by `sendLowBatteryNotification` to a platform-neutral name (e.g., `send_low_battery_notification`) across both `src/lib/desktopBridge.ts` and `src-tauri/src/main.rs`.

## 2. Fix Rust Backend & Project Hygiene Issues

### 2.1 Harden native notifications (`src-tauri/src/notifications.rs`)
- **Linux (`notify-send`):** Add `--` before the `<title>` and `<body>` arguments so titles/bodies starting with `-` cannot be parsed as CLI flags, and execute non-blocking (background thread or async spawn + reap) so it never blocks the Tauri command thread.
- **Windows:** Eliminate the unwaited `powershell` + temporary `System.Windows.Forms.NotifyIcon` + 5.5s `Start-Sleep` pattern that leaks child handles and leaves orphan tray icons. Prefer `tauri-plugin-notification` for native Windows/Linux/macOS desktop notifications, or if keeping a lightweight native approach, ensure processes are properly reaped and never spawn duplicate tray icons.
- **macOS / other targets:** Ensure the fallback branch is cleanly handled rather than silently misreported.

### 2.2 Fix OS detection (`src-tauri/src/main.rs`)
- Around line 242, replace `if cfg!(target_os = "windows") { "windows" } else { "linux" }` with explicit handling for `"windows"`, `"macos"`, and `"linux"` (or `std::env::consts::OS`).

### 2.3 Clean up unused template dependencies (`package.json`)
- Check whether `@google/genai` and `dotenv` are imported anywhere in `src/` or `scripts/`. If unused, remove them from `package.json` and update the lockfile.

## 3. UI/UX Improvements

### 3.1 Clear disabled state for threshold controls (`src/components/SettingsPanel.tsx`)
- Around lines 127–136, when `disabled={!settings.notificationsEnabled}` is active on the low-battery threshold buttons, add clear disabled styling (`disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none`) so users can immediately see they are inactive.

### 3.2 Contrast & responsive component grid (`src/components/DeviceRow.tsx`)
- Upgrade low-contrast `10px–11px` secondary labels (`text-[#64748B]` on `#0B0F14`/`#11161D`) to `#94A3B8` (`text-slate-400`) or higher to meet WCAG AA readability.
- Replace the hardcoded `grid-cols-3` on `batteryComponents` with a dynamic layout based on `batteryComponents.length` (e.g., `1` → `grid-cols-1`, `2` → `grid-cols-2`, `3+` → `grid-cols-3`) so single- or dual-component devices align cleanly without awkward empty columns.

### 3.3 Self-hosted fonts & tray window background (`src/index.css`)
- Because `tauri.conf.json` enforces `font-src 'self'`, verify that `"Manrope"` and `"JetBrains Mono"` are bundled locally (e.g., via `@fontsource` or local `@font-face` files in `public/fonts/`) rather than falling back to system fonts when uninstalled.
- If the frameless tray window uses rounded corners, avoid hardcoding an opaque `background-color: #0b0f14` on `html, body, #root` (keep root transparent and apply the surface color + border radius on the inner popup container).

## 4. Verification
After implementing all changes, run and report the results of:
1. `npm run typecheck` and `npm run lint`
2. `npm test`
3. `npm run build`
4. `cargo test --manifest-path src-tauri/Cargo.toml`
5. Summarize every modified file, any remaining edge cases, and confirm zero regressions in both browser preview (`npm run dev`) and Tauri desktop mode (`npm run tauri:dev`).
