import { DICTIONARIES } from "./i18n";
import type {
  AppSettings,
  ConnectionType,
  Locale,
  PeripheralDevice,
} from "./types";

export function deviceKey(device: PeripheralDevice): string {
  return (
    device.deviceId ??
    `${device.type}:${device.connectionType}:${device.labelEn}:${device.slotId}`
  );
}

export function hasBatteryReading(device: PeripheralDevice): boolean {
  return (
    device.connected &&
    device.batteryAvailable !== false &&
    Number.isFinite(device.batteryPct) &&
    device.batteryPct >= 0 &&
    device.batteryPct <= 100
  );
}

function singleConnectionLabel(
  connectionType: ConnectionType,
  isLaptop: boolean,
  locale: Locale,
): string {
  const dict = DICTIONARIES[locale].device.connections;
  if (isLaptop) return dict.system;
  switch (connectionType) {
    case "bluetooth":
      return dict.bluetooth;
    case "usb_dongle_2_4ghz":
      return dict.dongle;
    case "wired_usb":
      return dict.usb;
    default:
      return dict.unknown;
  }
}

export function connectionBadge(
  device: PeripheralDevice,
  locale: Locale,
): string {
  if (device.connectionTypes && device.connectionTypes.length > 1) {
    return device.connectionTypes
      .map((conn) =>
        singleConnectionLabel(conn, device.type === "laptop", locale),
      )
      .join(" + ");
  }
  return singleConnectionLabel(
    device.connectionType,
    device.type === "laptop",
    locale,
  );
}

export function deviceSubtitle(
  device: PeripheralDevice,
  locale: Locale,
): string {
  const d = DICTIONARIES[locale].device;
  if (!device.connected) return d.disconnected;
  if (!hasBatteryReading(device)) return d.batteryUnavailable;
  if (device.chargingState === "charging") return d.charging;
  if (device.chargingState === "full") return d.full;
  if (device.chargingState === "paused_limit") return d.pausedLimit;
  if (device.chargingState === "unknown") return d.stateUnknown;
  return d.onBattery;
}

export function isDeviceLow(
  device: PeripheralDevice,
  thresholdPct: number,
): boolean {
  if (!hasBatteryReading(device)) return false;
  if (device.chargingState === "charging" || device.chargingState === "full") {
    return false;
  }
  return device.batteryPct <= thresholdPct;
}

/** Hysteresis (+5%) prevents repeated notifications hovering near threshold. */
export function evaluateLowBattery(
  devices: PeripheralDevice[],
  settings: AppSettings,
  alerted: Set<string>,
): PeripheralDevice[] {
  const alerts: PeripheralDevice[] = [];
  for (const device of devices) {
    if (!hasBatteryReading(device)) continue;
    const key = deviceKey(device);
    if (
      device.chargingState === "charging" ||
      device.chargingState === "full" ||
      device.batteryPct > settings.lowBatteryThresholdPct + 5
    ) {
      alerted.delete(key);
      continue;
    }
    if (!settings.notificationsEnabled) continue;
    if (
      device.batteryPct <= settings.lowBatteryThresholdPct &&
      !alerted.has(key)
    ) {
      alerted.add(key);
      alerts.push(device);
    }
  }
  return alerts;
}

/** Pure equality check to prevent writing settings to disk on every hardware poll tick. */
export function settingsEqual(a: AppSettings, b: AppSettings): boolean {
  return (
    a.locale === b.locale &&
    a.notificationsEnabled === b.notificationsEnabled &&
    a.lowBatteryThresholdPct === b.lowBatteryThresholdPct &&
    a.launchAtLogin === b.launchAtLogin
  );
}

export function formatLastUpdated(
  ts: number | null,
  locale: Locale,
  nowMs = Date.now(),
): string {
  const f = DICTIONARIES[locale].footer;
  if (ts === null) return f.notUpdated;
  const diff = Math.max(0, nowMs - ts);
  if (diff < 15_000) return f.justNow;
  if (diff < 60_000) return f.secondsAgo(Math.max(1, Math.round(diff / 1000)));
  return f.minutesAgo(Math.max(1, Math.round(diff / 60_000)));
}
