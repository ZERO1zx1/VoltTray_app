import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { readUsbInterface } from "./usbIdentity";
import type { PeripheralDevice } from "../../../lib/types";

export function parseM220Info(report: Uint8Array): { pct: number; charging: boolean } | null {
  if (report.length !== 32 || report[0] !== 0x10 || report[1] !== 0 || report[3] < 11 || report[3] > 27 ||
      Buffer.from(report.slice(4, 8)).toString("ascii") !== "M220" || report[12] > 1 || report[13] > 100 || report[14] === 0) return null;
  if ((report.slice(4, 31).reduce((a, b) => a + b, 0) & 255) !== report[31]) return null;
  return { pct: report[13], charging: report[12] === 1 };
}

function query(file: string): ReturnType<typeof parseM220Info> {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, fs.constants.O_RDWR | fs.constants.O_NONBLOCK);
    const request = Buffer.alloc(33); request[1] = 0x10;
    if (fs.writeSync(fd, request) !== 33) return null;
    const deadline = performance.now() + 500;
    const pause = new Int32Array(new SharedArrayBuffer(4));
    while (performance.now() < deadline) {
      try {
        const report = Buffer.alloc(64);
        const count = fs.readSync(fd, report);
        const reading = parseM220Info(report.subarray(0, count));
        if (reading) return reading;
      } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EAGAIN") return null; }
      Atomics.wait(pause, 0, 0, 10);
    }
  } catch { /* Permission, unplug or unsupported response: never synthesize a level. */ }
  finally { if (fd !== undefined) fs.closeSync(fd); }
  return null;
}

const cache = new Map<string, { time: number; reading: ReturnType<typeof parseM220Info> }>();
export function enrichM220(devices: PeripheralDevice[]): void {
  if (process.platform !== "linux") return;
  const now = performance.now();
  for (const [key, value] of cache) if (now - value.time >= 30_000) cache.delete(key);
  try {
    for (const name of fs.readdirSync("/sys/class/hidraw")) {
      const dir = path.join("/sys/class/hidraw", name, "device");
      if (readUsbInterface(dir).interfaceNumber !== 2) continue;
      const event = Object.fromEntries(fs.readFileSync(path.join(dir, "uevent"), "utf8").trim().split("\n").map(line => {
        const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)];
      }));
      const id = event.HID_ID?.toLowerCase();
      if (!["0003:0000248a:00005d2e", "0003:0000249a:00005c2f"].includes(id)) continue;
      if (fs.readFileSync(path.join(dir, "report_descriptor")).toString("hex") !== "05010900a10119002aff00150026ff00750895208101750895209101c0") continue;
      const key = `usb:${event.HID_PHYS.toLowerCase().split("/input")[0]}|${id}`;
      if (!cache.has(key)) cache.set(key, { time: now, reading: query(path.join("/dev", name)) });
      const reading = cache.get(key)!.reading;
      const device = devices.find(d => d.deviceId === key);
      if (device && reading) Object.assign(device, { batteryPct: reading.pct, batteryAvailable: true,
        chargingState: reading.charging ? "charging" : "discharging", batterySource: "M220 HID",
        labelEn: "Valkyrie VK M3 Lite", labelMn: "Valkyrie VK M3 Lite" });
    }
  } catch { /* sysfs entries can disappear mid-scan */ }
}
