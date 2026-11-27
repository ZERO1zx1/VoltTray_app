# Supported Devices and Providers

VoltTray reports battery data only when a supported system interface returns a valid reading. It does not guess missing percentages or change device settings.

| OS | Provider | Reported data | Requirements and limits |
| --- | --- | --- | --- |
| Linux | <code>/sys/class/power_supply</code> and UPower | Laptop battery, charger, health when exposed; generic devices | UPower is optional for data available through sysfs. |
| Linux | OpenRazer sysfs | Supported Razer peripheral battery | OpenRazer must already be installed and expose the relevant sysfs data. |
| Linux | HeadsetControl | Supported headset battery | HeadsetControl must be installed and configured independently. |
| Linux | kAirPods D-Bus (<code>org.kairpods</code>) | AirPods left, right, case, and headphone components | An existing user-session kAirPods service and <code>busctl</code> are required. VoltTray does not pair Bluetooth devices or start the service. |
| Linux | M220 HID | Valkyrie VK M3 Lite battery and charging state over USB or 2.4 GHz receiver | Validated M220 response plus read permission; USB IDs <code>248a:5d2e</code> and <code>249a:5c2f</code>, interface <code>02</code>. See [M220 setup](m220.md). |
| Windows | <code>Win32_Battery</code> / WMI | System battery and design health when available | PowerShell and the Windows battery/WMI provider. |
| Windows | Windows PnP <code>DEVPKEY</code> battery property | Supported BLE/HID peripherals | PowerShell and a present PnP device that exposes the battery property. |
| macOS | No hardware battery adapter yet | — | Native notification fallback exists, but battery probing is not implemented. |

## Contributing a read-only adapter

1. Identify a documented OS interface or device protocol and cite its source in the adapter documentation.
2. Keep probing strictly read-only. Do not send configuration, pairing, firmware, RGB, audio, DPI, or charge-limit writes.
3. Validate response shape, range, status, and device identity before showing a percentage. Missing or invalid data stays unavailable.
4. Add fixture-based parser tests and tests for malformed, out-of-range, and disconnected responses.
5. Preserve bilingual labels and follow the existing provider boundary in <code>src-tauri/src/hardware/</code>.
6. Update this matrix and add setup or protocol notes under <code>docs/</code>.

Do not submit device serial numbers, Bluetooth addresses, or other personal identifiers in a public issue unless they have been removed or anonymized.

## Mouse compatibility

Detection and battery telemetry are separate capabilities. VoltTray does not require a known mouse brand when the OS identifies its input class. Linux USB discovery uses HID boot protocol or kernel relative X/Y capabilities; Windows includes present Mouse-class devices even without a battery property.

Battery percentages still require valid sysfs/UPower, OpenRazer, Windows PnP, or a supported model-specific response. Proprietary receivers that expose no battery telemetry remain unavailable, not zero percent. M220 is one optional adapter, not a universal mouse protocol. Wired and wireless receivers cannot always be distinguished by OS metadata.

These paths are covered by automated checks; this is not a claim that every mouse model has been physically tested. New proprietary adapters need documented protocols and device fixtures before being listed as supported.
