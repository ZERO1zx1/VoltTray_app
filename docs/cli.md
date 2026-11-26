# VoltTray CLI

The desktop binary accepts headless commands before starting the Tauri window. Run them from a terminal with the installed <code>volttray</code> executable.

## Commands

| Command | Result |
| --- | --- |
| <code>volttray</code> | Open the tray popup. |
| <code>volttray --minimized</code> | Start in the tray with the popup hidden. |
| <code>volttray status</code> | Print detected devices, connection, battery, charging state, and health when available. |
| <code>volttray status --json</code> | Print the raw hardware snapshot as JSON (<code>chargerConnected</code> and <code>devices</code>). |
| <code>volttray status --low</code> | Print non-charging devices at or below the saved threshold; defaults to 20% if no valid preference exists. |
| <code>volttray autostart status</code> | Report whether login autostart is enabled. |
| <code>volttray autostart on</code> / <code>volttray autostart off</code> | Enable or disable OS login autostart. |
| <code>volttray notify-test</code> | Request a test native desktop notification. |
| <code>volttray doctor</code> | Check local providers, optional Linux integrations, M220 access, and local-state readability. |
| <code>volttray --version</code> / <code>volttray --help</code> | Print version or usage. |

The JSON output is intended for local scripts. For example, a Waybar custom module can show the lowest available battery percentage:

~~~json
{
  "custom/volttray": {
    "exec": "volttray status --json | jq -r '[.devices[] | select(.batteryAvailable) | .batteryPct] | if length == 0 then \"VoltTray: —\" else \"VoltTray: \" + (min | tostring) + \"%\" end'",
    "interval": 30,
    "return-type": "string"
  }
}
~~~

For Polybar, use the same command as a <code>custom/script</code> module's <code>exec</code> value.

## Exit codes

| Code | Meaning |
| --- | --- |
| <code>0</code> | Command succeeded. For <code>status --low</code>, no low devices were found. |
| <code>1</code> | Runtime operation failed, <code>doctor</code> found a required environment failure, or <code>status --low</code> found one or more low devices. |
| <code>2</code> | Unknown command or invalid arguments. |

<code>status --json</code> and <code>status --low</code> cannot be combined. <code>doctor</code> treats optional Linux integrations (<code>busctl</code>/kAirPods, <code>notify-send</code>, the M220 udev rule, and readable hidraw devices) as warnings. Its exit code is nonzero for a required platform failure or unreadable existing state file.

The local preference file is named <code>volttray-state.json</code> under VoltTray's per-user configuration directory. It contains only <code>locale</code>, <code>notificationsEnabled</code>, <code>lowBatteryThresholdPct</code>, and <code>launchAtLogin</code>.
