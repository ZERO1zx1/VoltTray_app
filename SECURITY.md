# Security Policy

## Scope and threat model

VoltTray is a local-first desktop battery monitor. The desktop runtime probes supported local OS interfaces and has no telemetry or outbound analytics. Its Tauri Content Security Policy is offline-only (<code>default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'</code>). Local state is stored in the per-user application configuration directory as <code>volttray-state.json</code> and contains only four preferences: <code>locale</code>, <code>notificationsEnabled</code>, <code>lowBatteryThresholdPct</code>, and <code>launchAtLogin</code>.

The optional Linux M220 udev rule is restricted to the <code>bInterfaceNumber=02</code> vendor configuration interface and the listed IDs (<code>248a:5d2e</code> and <code>249a:5c2f</code>). It grants access only to those matching hidraw interfaces; it does not grant broad keyboard or mouse access. See [the rule](src-tauri/linux/70-volttray-m220.rules).

Install scripts and release downloads contact GitHub when the user explicitly runs them. That download behavior is separate from the desktop runtime.

## Reporting a vulnerability

Please do not publish exploitable details in a public issue. [Report a vulnerability privately through GitHub](https://github.com/ZERO1zx1/VoltTray_app/security/advisories/new) and include:

- affected version or commit;
- operating system and relevant configuration;
- a concise reproduction and impact description;
- any suggested mitigation.

Maintainers should acknowledge the report, coordinate a fix and release with the reporter, and publish an advisory after users have a reasonable update path. Do not include device serials, Bluetooth addresses, or unrelated personal data in a report.

## Supported versions

Security fixes are prepared for the current <code>main</code> branch. Older releases may not receive backports.
