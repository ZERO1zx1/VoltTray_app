import { execFileSync } from "node:child_process";
import fs from "node:fs";

export interface LinuxCapabilities {
  os: "linux" | "windows" | "other";
  sysfsAvailable: boolean;
  upowerAvailable: boolean;
  notifySendAvailable: boolean;
}

export interface HardwareActionRequest {
  action: "send_low_battery_alert";
  title?: string;
  body?: string;
}

export interface HardwareActionResult {
  ok: boolean;
  appliedToHardware: boolean;
  backend: string;
  messageEn: string;
  messageMn: string;
}

export function commandExists(cmd: string): boolean {
  if (process.platform !== "linux") return false;
  try {
    execFileSync("which", [cmd], { stdio: "ignore", timeout: 800 });
    return true;
  } catch {
    return false;
  }
}

export function detectLinuxCapabilities(): LinuxCapabilities {
  if (process.platform !== "linux") {
    return {
      os: process.platform === "win32" ? "windows" : "other",
      sysfsAvailable: false,
      upowerAvailable: false,
      notifySendAvailable: false,
    };
  }

  return {
    os: "linux",
    sysfsAvailable: fs.existsSync("/sys/class/power_supply"),
    upowerAvailable: commandExists("upower"),
    notifySendAvailable: commandExists("notify-send"),
  };
}

/** Strictly read-only hardware policy: only desktop alert delivery is allowed. */
export function executeLinuxHardwareAction(
  req: HardwareActionRequest,
): HardwareActionResult {
  if (process.platform !== "linux") {
    return {
      ok: true,
      appliedToHardware: false,
      backend: "local_profile",
      messageEn: "Not running on Linux host",
      messageMn: "Linux систем биш байна",
    };
  }

  if (req.action === "send_low_battery_alert" && commandExists("notify-send")) {
    try {
      execFileSync(
        "notify-send",
        [
          "-a",
          "VoltTray",
          "-u",
          "normal",
          req.title ?? "Low Battery",
          req.body ?? "Please connect charger.",
        ],
        { timeout: 1000 },
      );
      return {
        ok: true,
        appliedToHardware: true,
        backend: "notify-send",
        messageEn: "Sent native Linux desktop notification",
        messageMn: "Linux системийн мэдэгдэл илгээлээ",
      };
    } catch {
      // Fall through to local_profile
    }
  }

  return {
    ok: true,
    appliedToHardware: false,
    backend: "local_profile",
    messageEn: "Notification backend unavailable",
    messageMn: "Мэдэгдлийн үйлчилгээ олдсонгүй",
  };
}
