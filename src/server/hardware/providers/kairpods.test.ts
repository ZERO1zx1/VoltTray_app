import test from "node:test";
import assert from "node:assert/strict";
import { parseAirPodsReadings } from "./kairpods";

const wrap = (items: unknown) =>
  JSON.stringify({ type: "s", data: [JSON.stringify(items)] });
test("AirPods components preserve zero, exclude case from earbuds and reject offline data", () => {
  const device = {
    address: "AA:BB:CC:DD:EE:FF",
    connected: true,
    name: "Test AirPods",
    battery: {
      left: { level: 0, charging: false },
      right: { level: 82, charging: true },
      case: { level: 99, charging: true },
    },
  };
  const result = parseAirPodsReadings(
    wrap([
      device,
      device,
      { ...device, address: "11:22:33:44:55:66", connected: false },
    ]),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].batteryPct, 0);
  assert.equal(result[0].charging, false);
  assert.equal(result[0].components.length, 3);
  assert.equal(result[0].deviceId, "bluetooth:aa:bb:cc:dd:ee:ff");
});
test("invalid payloads and unknown levels never become a percentage", () => {
  for (const raw of [
    "garbage",
    wrap(null),
    wrap([null]),
    wrap([{ connected: true, address: "invalid" }]),
  ]) {
    assert.deepEqual(parseAirPodsReadings(raw), []);
  }
  const item = {
    address: "11:22:33:44:55:66",
    connected: true,
    battery: { headphone: { level: 255, charging: false } },
  };
  assert.deepEqual(parseAirPodsReadings(wrap([item])), []);
  item.battery.headphone.level = 95;
  assert.equal(parseAirPodsReadings(wrap([item]))[0].batteryPct, 95);
});
