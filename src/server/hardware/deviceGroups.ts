import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PeripheralDevice } from "../../lib/types";

interface Group { id: string; name: string; deviceIds: string[] }
export function groupDevices(devices: PeripheralDevice[], groups: Group[]): PeripheralDevice[] {
  let result = [...devices];
  for (const group of groups) {
    if (!group || typeof group.id !== "string" || typeof group.name !== "string" || !Array.isArray(group.deviceIds)) continue;
    const members = result.filter(d => d.deviceId && group.deviceIds.includes(d.deviceId));
    if (!members.length) continue;
    members.sort((a, b) => Number(b.batteryAvailable !== false) - Number(a.batteryAvailable !== false) ||
      Number(b.connectionType === "wired_usb") - Number(a.connectionType === "wired_usb"));
    const firstIndex = result.findIndex(d => members.includes(d));
    const combined = { ...members[0], deviceId: `group:${group.id}`, labelEn: group.name, labelMn: group.name,
      connectionTypes: [...new Set(members.map(d => d.connectionType))].sort() };
    result = result.filter(d => !members.includes(d));
    result.splice(firstIndex, 0, combined);
  }
  return result.map((d, i) => ({ ...d, slotId: `slot_${i + 1}` as PeripheralDevice["slotId"] }));
}

export function applyConfirmedDeviceGroups(devices: PeripheralDevice[]): PeripheralDevice[] {
  try {
    const file = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "app.volttray.monitor", "device-pairs.json");
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(config.groups) ? groupDevices(devices, config.groups) : devices;
  } catch { return devices; }
}
