import { execFileSync } from "node:child_process";
import type { PeripheralDevice } from "../../../lib/types";

export interface AirPodsReading {
  deviceId: string;
  name: string;
  batteryPct: number;
  charging: boolean;
  components: NonNullable<PeripheralDevice["batteryComponents"]>;
}

export function parseAirPodsReadings(raw: string): AirPodsReading[] {
  try {
    const envelope = JSON.parse(raw);
    if (envelope?.type !== "s" || typeof envelope.data?.[0] !== "string")
      return [];
    const items = JSON.parse(envelope.data[0]);
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    return items.flatMap((item): AirPodsReading[] => {
      if (
        item?.connected !== true ||
        typeof item.address !== "string" ||
        !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(item.address)
      )
        return [];
      const deviceId = `bluetooth:${item.address.toLowerCase()}`;
      if (seen.has(deviceId)) return [];
      const components: AirPodsReading["components"] = [];
      for (const id of ["left", "right", "case", "headphone"] as const) {
        const c = item.battery?.[id];
        if (
          Number.isInteger(c?.level) &&
          c.level >= 0 &&
          c.level <= 100 &&
          typeof c.charging === "boolean"
        ) {
          components.push({ id, batteryPct: c.level, charging: c.charging });
        }
      }
      if (!components.length) return [];
      seen.add(deviceId);
      const listening = components.filter((c) => c.id !== "case");
      const active = listening.length ? listening : components;
      return [
        {
          deviceId,
          name:
            typeof item.name === "string" && item.name.trim()
              ? item.name
              : "AirPods",
          batteryPct: Math.min(...active.map((c) => c.batteryPct)),
          charging: active.every((c) => c.charging),
          components,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function probeAirPodsReadings(): AirPodsReading[] {
  if (process.platform !== "linux") return [];
  try {
    return parseAirPodsReadings(
      execFileSync(
        "busctl",
        [
          "--user",
          "--json=short",
          "--timeout=1s",
          "--auto-start=no",
          "--allow-interactive-authorization=no",
          "call",
          "org.kairpods",
          "/org/kairpods/manager",
          "org.kairpods.manager",
          "GetDevices",
        ],
        {
          encoding: "utf8",
          timeout: 1500,
          maxBuffer: 256 * 1024,
          stdio: ["ignore", "pipe", "ignore"],
        },
      ),
    );
  } catch {
    return [];
  }
}
