import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL_DEVICES, INITIAL_SETTINGS } from "./defaults";
import {
  componentGridClass,
  connectionBadge,
  deviceSubtitle,
  evaluateLowBattery,
  formatLastUpdated,
  hasBatteryReading,
  isDeviceLow,
  settingsEqual,
} from "./battery";

test("low battery threshold, identity stability, recharge hysteresis and notifications toggle", () => {
  const alerted = new Set<string>();
  const settings = {
    ...INITIAL_SETTINGS,
    notificationsEnabled: true,
    lowBatteryThresholdPct: 20 as const,
  };
  const device = {
    ...INITIAL_DEVICES[1],
    deviceId: "test-headset",
    connected: true,
    batteryAvailable: true,
    batteryPct: 19,
    chargingState: "discharging" as const,
  };

  assert.equal(
    evaluateLowBattery(
      [device],
      { ...settings, notificationsEnabled: false },
      alerted,
    ).length,
    0,
  );
  assert.equal(evaluateLowBattery([device], settings, alerted).length, 1);
  // Same device moving slot should not re-alert
  assert.equal(
    evaluateLowBattery([{ ...device, slotId: "slot_8" }], settings, alerted)
      .length,
    0,
  );
  // Still inside +5% hysteresis band (23 <= 25): stays alerted
  evaluateLowBattery([{ ...device, batteryPct: 23 }], settings, alerted);
  assert.equal(evaluateLowBattery([device], settings, alerted).length, 0);
  // Above +5% hysteresis band (26 > 25): clears alert state
  evaluateLowBattery([{ ...device, batteryPct: 26 }], settings, alerted);
  assert.equal(evaluateLowBattery([device], settings, alerted).length, 1);
  // Charging clears alert state
  evaluateLowBattery(
    [{ ...device, chargingState: "charging" }],
    settings,
    alerted,
  );
  assert.equal(evaluateLowBattery([device], settings, alerted).length, 1);
});

test("missing and disconnected readings are not treated as 0% battery", () => {
  const device = {
    ...INITIAL_DEVICES[0],
    connected: true,
    batteryPct: 0,
    batteryAvailable: true,
  };
  assert.equal(hasBatteryReading(device), true);
  assert.equal(
    hasBatteryReading({ ...device, batteryAvailable: false }),
    false,
  );
  assert.equal(hasBatteryReading({ ...device, connected: false }), false);
  assert.equal(hasBatteryReading({ ...device, batteryPct: Number.NaN }), false);
  assert.equal(
    deviceSubtitle({ ...device, chargingState: "discharging" }, "en"),
    "On battery",
  );
  assert.equal(
    deviceSubtitle({ ...device, batteryAvailable: false }, "mn"),
    "Холбогдсон · Цэнэгийн мэдээлэлгүй",
  );
  assert.equal(isDeviceLow({ ...device, chargingState: "charging" }, 20), false);
  assert.equal(
    isDeviceLow({ ...device, batteryPct: 15, chargingState: "discharging" }, 20),
    true,
  );
});

test("settingsEqual prevents unnecessary disk writes and formatLastUpdated handles locales", () => {
  assert.equal(
    settingsEqual(INITIAL_SETTINGS, { ...INITIAL_SETTINGS }),
    true,
  );
  assert.equal(
    settingsEqual(INITIAL_SETTINGS, {
      ...INITIAL_SETTINGS,
      lowBatteryThresholdPct: 15,
    }),
    false,
  );
  assert.equal(formatLastUpdated(null, "en", 100_000), "Not synced");
  assert.equal(formatLastUpdated(95_000, "mn", 100_000), "Саяхан");
  assert.equal(formatLastUpdated(60_000, "en", 100_000), "40s ago");
  assert.equal(formatLastUpdated(0, "mn", 180_000), "3м өмнө");
  assert.equal(
    connectionBadge(
      {
        ...INITIAL_DEVICES[1],
        connectionTypes: ["wired_usb", "usb_dongle_2_4ghz"],
      },
      "en",
    ),
    "USB + 2.4GHz",
  );
  assert.equal(componentGridClass(1), "grid-cols-1");
  assert.equal(componentGridClass(2), "grid-cols-2");
  assert.equal(componentGridClass(3), "grid-cols-3");
  assert.equal(componentGridClass(4), "grid-cols-3");
});
