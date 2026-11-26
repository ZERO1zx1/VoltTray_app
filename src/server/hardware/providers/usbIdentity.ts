import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function lsusbNames(): Map<string, string> {
  try {
    const output = execFileSync("lsusb", [], {
      encoding: "utf8",
      timeout: 1500,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return new Map(
      output.split("\n").flatMap((line) => {
        const match = line.match(/\bID ([0-9a-f]{4}:[0-9a-f]{4})\s+(.+)/i);
        return match
          ? [[match[1].toLowerCase(), match[2].trim()] as [string, string]]
          : [];
      }),
    );
  } catch {
    return new Map();
  }
}

/** USB boot protocol, not vendor branding, identifies the primary input interface. */
export function readUsbInterface(devicePath: string): {
  interfaceNumber?: number;
  inputType?: "keyboard" | "mouse";
} {
  try {
    let dir = fs.realpathSync(devicePath);
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, "bInterfaceProtocol"))) {
        const read = (name: string) =>
          Number.parseInt(
            fs.readFileSync(path.join(dir, name), "utf8").trim(),
            16,
          );
        const protocol =
          read("bInterfaceSubClass") === 1 ? read("bInterfaceProtocol") : 0;
        return {
          interfaceNumber: read("bInterfaceNumber"),
          inputType:
            protocol === 1 ? "keyboard" : protocol === 2 ? "mouse" : undefined,
        };
      }
      dir = path.dirname(dir);
    }
  } catch {
    /* Device may disappear during enumeration. */
  }
  return {};
}
