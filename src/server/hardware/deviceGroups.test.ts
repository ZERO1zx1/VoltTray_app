import test from "node:test";
import assert from "node:assert/strict";
import { groupDevices } from "./deviceGroups";
import { INITIAL_DEVICES } from "../../lib/defaults";

test("explicit pairs combine connections, prefer valid battery and leave unrelated devices alone", () => {
  const cable = {
    ...INITIAL_DEVICES[0],
    deviceId: "cable",
    connectionType: "wired_usb" as const,
    batteryAvailable: false,
  };
  const receiver = {
    ...cable,
    deviceId: "receiver",
    connectionType: "usb_dongle_2_4ghz" as const,
    batteryAvailable: true,
    batteryPct: 64,
  };
  const other = { ...receiver, deviceId: "other" };
  const groups = [
    { id: "my-mouse", name: "VK M3 Lite", deviceIds: ["cable", "receiver"] },
  ];
  const result = groupDevices([cable, receiver, other], groups);
  assert.equal(result.length, 2);
  assert.equal(result[0].batteryPct, 64);
  assert.equal(result[0].deviceId, "group:my-mouse");
  assert.equal(result[0].connectionTypes?.length, 2);
  assert.equal(result[1].deviceId, "other");
  assert.equal(groupDevices([receiver], groups)[0].deviceId, "group:my-mouse");
  assert.equal(groupDevices([cable, receiver], []).length, 2);
});
