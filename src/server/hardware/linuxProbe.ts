import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { lsusbNames, readUsbInterface } from "./providers/usbIdentity";
import { enrichM220 } from "./providers/m220";
import { applyConfirmedDeviceGroups } from "./deviceGroups";
import { probeAirPodsReadings } from "./providers/kairpods";
import type {
  ChargingState,
  ConnectionType,
  DeviceType,
  DisplayServer,
  LinuxDistro,
  OsPlatform,
  PeripheralDevice,
  ProtocolDriver,
} from "../../lib/types";

export interface SysfsPowerSupplyEntry {
  name: string;
  type: string;
  scope: string;
  modelName: string;
  manufacturer?: string;
  hidPhys?: string;
  sysfsPath?: string;
  capacity: number;
  capacityLevel?: string;
  status: string;
  online?: string;
  energyFull?: number;
  energyFullDesign?: number;
}

export interface OpenRazerSysfsEntry {
  driver: string;
  deviceType: string;
  chargeLevel: number;
  chargeStatus: string;
}

export interface LinuxPowerSnapshot {
  chargerConnected: boolean;
  devices: PeripheralDevice[];
}

export interface HostEnvironmentInfo {
  os: OsPlatform;
  displayServer: DisplayServer;
  distro: LinuxDistro;
  sysfsDeviceCount: number;
  memoryRssMb: number;
}

const GENERIC_LABELS_EN = new Set([
  "System Battery",
  "Wireless Mouse",
  "Keyboard",
  "Headset",
  "Controller",
  "USB / Mobile Device",
  "Battery",
]);

function isGenericLabel(label: string): boolean {
  return GENERIC_LABELS_EN.has(label.trim());
}

function sanitizeModelLabel(model?: string): string {
  const trimmed = (model ?? "").trim();
  if (!trimmed) return "";
  // Skip bare MAC addresses or raw kernel sysfs IDs
  if (/^([0-9a-f]{2}[:_-]){5}[0-9a-f]{2}$/i.test(trimmed)) return "";
  if (/^(hid-|bat\d+|usb-|ucsi-)/i.test(trimmed)) return "";
  return trimmed;
}

export function inferDeviceTypeFromSysfs(
  entry: Pick<SysfsPowerSupplyEntry, "name" | "modelName" | "scope">,
): DeviceType {
  const nameLower = entry.name.toLowerCase();
  const scopeLower = (entry.scope ?? "").toLowerCase();
  if (/^bat\d+$/i.test(entry.name.trim()) || scopeLower === "system") {
    return "laptop";
  }
  const hint = `${nameLower} ${entry.modelName}`.toLowerCase();
  if (
    hint.includes("mouse") ||
    hint.includes("g pro") ||
    hint.includes("superlight") ||
    hint.includes("viper") ||
    hint.includes("deathadder") ||
    hint.includes("mx master") ||
    hint.includes("basilisk") ||
    hint.includes("aerox") ||
    hint.includes("pulsefire")
  ) {
    return "mouse";
  }
  if (
    hint.includes("keyboard") ||
    hint.includes("kbd") ||
    hint.includes("keychron") ||
    hint.includes("wooting") ||
    hint.includes("blackwidow") ||
    hint.includes("g915") ||
    hint.includes("huntsman")
  ) {
    return "keyboard";
  }
  if (
    hint.includes("headset") ||
    hint.includes("headphone") ||
    hint.includes("arctis") ||
    hint.includes("audio") ||
    hint.includes("cloud") ||
    hint.includes("wh-1000") ||
    hint.includes("airpods") ||
    hint.includes("barracuda") ||
    hint.includes("blackshark") ||
    hint.includes("hyperx") ||
    hint.includes("corsair") ||
    hint.includes("virtuoso") ||
    hint.includes("void") ||
    hint.includes("g733") ||
    hint.includes("g535") ||
    hint.includes("g435") ||
    hint.includes("g935") ||
    hint.includes("pro x")
  ) {
    return "headset";
  }
  if (
    hint.includes("controller") ||
    hint.includes("ps-controller") ||
    hint.includes("dualsense") ||
    hint.includes("dualshock") ||
    hint.includes("xbox") ||
    hint.includes("gamepad") ||
    hint.includes("gaming-input") ||
    hint.includes("gaming_input") ||
    hint.includes("joy-con") ||
    hint.includes("8bitdo")
  ) {
    return "controller";
  }
  if (
    hint.includes("phone") ||
    hint.includes("iphone") ||
    hint.includes("ipad") ||
    hint.includes("tablet") ||
    hint.includes("android") ||
    hint.includes("pixel") ||
    hint.includes("galaxy") ||
    hint.includes("ups")
  ) {
    return "other";
  }
  return "unknown";
}

function hasBluetoothToken(hint: string): boolean {
  return (
    hint.includes("bluez") ||
    hint.includes("bluetooth") ||
    /\bble\b/.test(hint) ||
    /\bhci\d*\b/.test(hint) ||
    /(?:^|[\s/_-])bt(?:$|[\s/_-])/.test(hint)
  );
}

export function inferConnectionFromSysfs(
  entry: Pick<
    SysfsPowerSupplyEntry,
    "name" | "modelName" | "scope" | "hidPhys" | "sysfsPath" | "status"
  >,
  devType: DeviceType,
): ConnectionType {
  if (devType === "laptop") return "wired_usb";
  const statusLower = (entry.status ?? "").trim().toLowerCase();
  if (statusLower === "charging") return "wired_usb";

  const physLower = (entry.hidPhys ?? "").toLowerCase();
  const pathLower = (entry.sysfsPath ?? "").toLowerCase();
  const nameLower = `${entry.name} ${entry.modelName}`.toLowerCase();

  if (
    physLower.startsWith("hci") ||
    hasBluetoothToken(`${nameLower} ${physLower} ${pathLower}`)
  ) {
    return "bluetooth";
  }
  if (
    nameLower.includes("hidpp") ||
    nameLower.includes("dongle") ||
    nameLower.includes("receiver") ||
    nameLower.includes("lightspeed") ||
    nameLower.includes("unifying") ||
    nameLower.includes("bolt") ||
    nameLower.includes("wireless") ||
    nameLower.includes("razer")
  ) {
    return "usb_dongle_2_4ghz";
  }
  if (physLower.startsWith("usb-") || pathLower.includes("/usb")) {
    return devType === "other" ? "wired_usb" : "usb_dongle_2_4ghz";
  }
  return "usb_dongle_2_4ghz";
}

export function inferDriverFromSysfs(
  entry: Pick<SysfsPowerSupplyEntry, "name" | "modelName">,
): ProtocolDriver {
  const nameLower = `${entry.name} ${entry.modelName}`.toLowerCase();
  if (nameLower.includes("hidpp")) return "hidpp";
  if (nameLower.includes("razer")) return "razer_openrazer";
  if (nameLower.includes("steelseries") || nameLower.includes("arctis"))
    return "steelseries_hid";
  if (hasBluetoothToken(nameLower)) return "standard_ble_bas";
  return "upower_generic";
}

export function mapSysfsStatus(status: string): ChargingState {
  const s = status.trim().toLowerCase();
  if (s === "charging" || s === "pending-charge") return "charging";
  if (s === "discharging") return "discharging";
  if (s === "full" || s === "fully-charged") return "full";
  if (s === "not charging" || s === "not-charging") return "paused_limit";
  return "unknown";
}

export function mapCapacityLevelToPct(level?: string): number {
  const l = (level ?? "").trim().toLowerCase();
  if (l === "full") return 100;
  if (l === "high") return 80;
  if (l === "normal") return 50;
  if (l === "low") return 15;
  if (l === "critical") return 5;
  return NaN;
}

const SLOT_IDS: Array<PeripheralDevice["slotId"]> = [
  "slot_1",
  "slot_2",
  "slot_3",
  "slot_4",
  "slot_5",
  "slot_6",
  "slot_7",
  "slot_8",
];

function buildBatteryDevice(
  idx: number,
  devType: DeviceType,
  batteryPct: number,
  chargingState: ChargingState,
  connectionType: ConnectionType,
  protocolDriver: ProtocolDriver,
  customModel?: string,
  healthPct?: number,
): PeripheralDevice {
  const labelMap: Record<DeviceType, { en: string; mn: string }> = {
    laptop: { en: "System Battery", mn: "Компьютерын батарей" },
    mouse: { en: "Wireless Mouse", mn: "Утасгүй хулгана" },
    keyboard: { en: "Keyboard", mn: "Гар" },
    headset: { en: "Headset", mn: "Чихэвч" },
    controller: { en: "Controller", mn: "Гар удирдлага" },
    other: { en: "USB / Mobile Device", mn: "USB / Утас төхөөрөмж" },
    unknown: { en: "Battery", mn: "Батарей" },
  };

  const cleanModel =
    devType === "laptop" ? "" : sanitizeModelLabel(customModel);
  const labelEn = cleanModel || labelMap[devType].en;
  const labelMn = cleanModel || labelMap[devType].mn;
  const hasValidHealth =
    typeof healthPct === "number" &&
    Number.isFinite(healthPct) &&
    healthPct > 0 &&
    healthPct <= 100;

  return {
    slotId: SLOT_IDS[idx] ?? "slot_8",
    type: devType,
    labelEn,
    labelMn,
    batteryPct: Math.max(0, Math.min(100, Math.round(batteryPct))),
    batteryAvailable: true,
    chargingState,
    connectionType,
    connected: true,
    supportsHealth: hasValidHealth,
    healthPct: hasValidHealth ? Math.round(healthPct) : undefined,
    protocolDriver,
  };
}

function isSysfsChargerType(
  typeLower: string,
  scopeLower: string,
  hasBatteryCapacity: boolean,
): boolean {
  if (typeLower === "mains") return true;
  if (typeLower.startsWith("usb")) {
    // USB/USB_PD/USB_C power supply is a charger unless it explicitly reports a peripheral device battery
    return !(scopeLower === "device" && hasBatteryCapacity);
  }
  return false;
}

export function detectSysfsChargerConnected(
  entries: SysfsPowerSupplyEntry[],
): boolean {
  return entries.some((entry) => {
    const typeLower = entry.type.trim().toLowerCase();
    const scopeLower = (entry.scope ?? "").trim().toLowerCase();
    const hasCap =
      Number.isFinite(entry.capacity) ||
      Number.isFinite(mapCapacityLevelToPct(entry.capacityLevel));
    const online = (entry.online ?? "").trim();
    const statusLower = entry.status.trim().toLowerCase();
    if (isSysfsChargerType(typeLower, scopeLower, hasCap)) {
      return online === "1" || statusLower === "online";
    }
    return statusLower === "charging";
  });
}

/**
 * Parses Linux /sys/class/power_supply entries for all battery & charger devices
 * (laptop system batteries + wireless/USB peripherals, excluding AC/USB charger rows).
 */
export function parseSysfsPowerSupply(
  entries: SysfsPowerSupplyEntry[],
): PeripheralDevice[] {
  const batteryEntries = entries.filter((entry) => {
    const typeLower = entry.type.trim().toLowerCase();
    const scopeLower = (entry.scope ?? "").trim().toLowerCase();
    const resolvedCap = Number.isFinite(entry.capacity)
      ? entry.capacity
      : mapCapacityLevelToPct(entry.capacityLevel);
    const hasCap =
      Number.isFinite(resolvedCap) && resolvedCap >= 0 && resolvedCap <= 100;
    if (isSysfsChargerType(typeLower, scopeLower, hasCap)) return false;
    return hasCap;
  });

  return batteryEntries.slice(0, 8).map((entry, idx) => {
    const devType = inferDeviceTypeFromSysfs(entry);
    const conn = inferConnectionFromSysfs(entry, devType);
    const chargingState = mapSysfsStatus(entry.status);
    const resolvedCap = Number.isFinite(entry.capacity)
      ? entry.capacity
      : mapCapacityLevelToPct(entry.capacityLevel);
    const healthPct =
      entry.energyFull &&
      entry.energyFullDesign &&
      entry.energyFullDesign > 0
        ? Math.min(
            100,
            Math.max(
              1,
              Math.round((entry.energyFull / entry.energyFullDesign) * 100),
            ),
          )
        : undefined;
    const device = buildBatteryDevice(
      idx,
      devType,
      resolvedCap,
      chargingState,
      conn,
      inferDriverFromSysfs(entry),
      entry.modelName,
      healthPct,
    );
    device.batterySource = "sysfs";
    return device;
  });
}

const UPOWER_KINDS = new Set([
  "line-power",
  "battery",
  "mouse",
  "keyboard",
  "headset",
  "headphones",
  "gaming-input",
  "phone",
  "tablet",
  "ups",
  "media-player",
]);

/**
 * Parses `upower -d` output to capture charger (`line_power`) status plus
 * laptop batteries, USB/HID peripherals, BlueZ devices, and USB-connected phones/tablets.
 */
export function parseUpowerSnapshot(dumpText: string): LinuxPowerSnapshot {
  const blocks = dumpText.split(/\n(?=Device:\s+)/g);
  const devices: PeripheralDevice[] = [];
  let chargerConnected = false;

  for (const block of blocks) {
    const deviceHeaderMatch = block.match(/^Device:\s+(.+)/m);
    if (!deviceHeaderMatch) continue;
    const objPath = deviceHeaderMatch[1].trim().toLowerCase();
    if (objPath.includes("displaydevice")) continue;

    const lines = block.split("\n");
    let kind = "";
    let model = "";
    let vendor = "";
    let nativePath = "";
    let state = "";
    let iconName = "";
    let capacityLevel = "";
    let powerSupply = false;
    let present: boolean | null = null;
    let online = false;
    let percentage = NaN;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const idx = line.indexOf(":");
      if (idx <= 0) {
        const bare = line.toLowerCase();
        if (!kind && UPOWER_KINDS.has(bare)) {
          kind = bare;
        }
        continue;
      }
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();

      if (key === "model") model = val;
      else if (key === "vendor") vendor = val;
      else if (key === "native-path") nativePath = val;
      else if (key === "icon-name") iconName = val.toLowerCase();
      else if (key === "capacity-level") capacityLevel = val;
      else if (key === "power supply")
        powerSupply = val.toLowerCase() === "yes";
      else if (key === "present") present = val.toLowerCase() === "yes";
      else if (key === "online") online = val.toLowerCase() === "yes";
      else if (key === "state") state = val.toLowerCase();
      else if (key === "percentage") {
        const num = Number.parseFloat(val.replace("%", "").trim());
        if (Number.isFinite(num)) percentage = num;
      } else if (!kind && UPOWER_KINDS.has(key)) {
        kind = key;
      }
    }

    if (objPath.includes("line_power") || kind === "line-power") {
      if (online) chargerConnected = true;
      continue;
    }

    if (devices.length >= 8) continue;
    if (!Number.isFinite(percentage) && capacityLevel) {
      percentage = mapCapacityLevelToPct(capacityLevel);
    }
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)
      continue;
    if (present === false && percentage === 0) continue;

    if (!kind) {
      if (objPath.includes("battery_bat")) kind = "battery";
      else if (objPath.includes("/mouse")) kind = "mouse";
      else if (objPath.includes("/keyboard")) kind = "keyboard";
      else if (objPath.includes("/headset") || objPath.includes("/headphones"))
        kind = "headset";
      else if (objPath.includes("/gaming")) kind = "gaming-input";
      else if (objPath.includes("/phone")) kind = "phone";
      else if (objPath.includes("/tablet") || objPath.includes("/media-player"))
        kind = "tablet";
      else if (objPath.includes("/ups")) kind = "ups";
    }

    const connHint =
      `${objPath} ${nativePath} ${model} ${vendor} ${iconName}`.toLowerCase();
    const isSystemLaptopBattery =
      objPath.includes("battery_bat") ||
      (kind === "battery" &&
        powerSupply &&
        !connHint.includes("hid") &&
        !connHint.includes("usb") &&
        !hasBluetoothToken(connHint));

    let devType: DeviceType = inferDeviceTypeFromSysfs({
      name: `${objPath} ${nativePath} ${iconName}`,
      modelName: `${vendor} ${model}`.trim(),
      scope: isSystemLaptopBattery ? "System" : "Device",
    });

    if (isSystemLaptopBattery) devType = "laptop";
    else if (kind === "mouse") devType = "mouse";
    else if (kind === "keyboard") devType = "keyboard";
    else if (kind === "headset" || kind === "headphones") devType = "headset";
    else if (kind === "gaming-input") devType = "controller";
    else if (
      kind === "phone" ||
      kind === "tablet" ||
      kind === "ups" ||
      kind === "media-player"
    ) {
      devType = "other";
    }

    const chargingState = mapSysfsStatus(state || "discharging");
    if (chargingState === "charging") chargerConnected = true;

    const connectionType: ConnectionType =
      devType === "laptop"
        ? "wired_usb"
        : hasBluetoothToken(connHint)
          ? "bluetooth"
          : chargingState === "charging" ||
              (devType === "other" &&
                (connHint.includes("usb") ||
                  kind === "phone" ||
                  kind === "ups"))
            ? "wired_usb"
            : "usb_dongle_2_4ghz";

    const driver: ProtocolDriver = connHint.includes("hidpp")
      ? "hidpp"
      : connectionType === "bluetooth"
        ? "standard_ble_bas"
        : "upower_generic";

    const device = buildBatteryDevice(
      devices.length,
      devType,
      percentage,
      chargingState,
      connectionType,
      driver,
      model,
    );
    const mac = nativePath.match(
      /(?:^|dev_)((?:[0-9a-f]{2}[:_]){5}[0-9a-f]{2})(?:$|\/)/i,
    )?.[1];
    if (mac)
      device.deviceId = `bluetooth:${mac.replaceAll("_", ":").toLowerCase()}`;
    device.batterySource = "UPower";
    devices.push(device);
  }

  return { chargerConnected, devices };
}

export function parseUpowerDump(dumpText: string): PeripheralDevice[] {
  return parseUpowerSnapshot(dumpText).devices;
}

export function parseOpenRazerSysfsEntry(
  entry: OpenRazerSysfsEntry,
): PeripheralDevice | null {
  if (
    !Number.isFinite(entry.chargeLevel) ||
    entry.chargeLevel < 0 ||
    entry.chargeLevel > 255
  ) {
    return null;
  }
  const pct = Math.max(
    0,
    Math.min(100, Math.round((entry.chargeLevel * 100) / 255)),
  );
  const chargingState: ChargingState =
    entry.chargeStatus.trim() === "1" ? "charging" : "discharging";
  const drv = entry.driver.toLowerCase();
  let devType: DeviceType = inferDeviceTypeFromSysfs({
    name: drv,
    modelName: entry.deviceType,
    scope: "Device",
  });
  if (drv.includes("kbd")) devType = "keyboard";
  else if (drv.includes("mouse")) devType = "mouse";
  else if (drv.includes("headset")) devType = "headset";

  const conn: ConnectionType =
    chargingState === "charging" ||
    entry.deviceType.toLowerCase().includes("wired")
      ? "wired_usb"
      : "usb_dongle_2_4ghz";

  return buildBatteryDevice(
    0,
    devType,
    pct,
    chargingState,
    conn,
    "razer_openrazer",
    entry.deviceType,
  );
}

export function parseHeadsetControlJson(rawJson: string): PeripheralDevice[] {
  try {
    const parsed = JSON.parse(rawJson) as {
      devices?: Array<{
        device?: string;
        battery?: { status?: string; level?: number };
      }>;
    };
    const items = Array.isArray(parsed.devices) ? parsed.devices : [];
    const out: PeripheralDevice[] = [];
    for (const item of items) {
      const status = (item.battery?.status ?? "").toUpperCase();
      const level = item.battery?.level;
      if (
        status === "BATTERY_UNAVAILABLE" ||
        typeof level !== "number" ||
        !Number.isFinite(level) ||
        level < 0
      ) {
        continue;
      }
      const chargingState: ChargingState =
        status === "BATTERY_CHARGING"
          ? "charging"
          : level >= 100
            ? "full"
            : "discharging";
      const conn: ConnectionType =
        chargingState === "charging" ? "wired_usb" : "usb_dongle_2_4ghz";
      out.push(
        buildBatteryDevice(
          out.length,
          "headset",
          level,
          chargingState,
          conn,
          "steelseries_hid",
          item.device || "USB Headset",
        ),
      );
    }
    return out;
  } catch {
    return [];
  }
}

export interface UsbHidrawSysfsEntry {
  interfaceNumber?: number;
  inputType?: "keyboard" | "mouse";
  hidrawName: string;
  hidId: string;
  hidName: string;
  hidPhys: string;
}

const KNOWN_PERIPHERAL_VIDS = new Set([
  "046d", // Logitech
  "1532", // Razer
  "1038", // SteelSeries
  "0951", // HyperX
  "1b1c", // Corsair
  "3434", // Keychron
  "3554", // Compx / VXE / Attack Shark / Darmoshark 2.4GHz
  "3710", // Pulsar
  "258a", // Glorious / SinoWealth
  "054c", // Sony
  "045e", // Microsoft
  "2dc8", // 8BitDo
  "248a", // Maxxter / Telink 2.4GHz
  "1ea7", // SHARKOON / 2.4GHz wireless mouse
  "31e3", // Wooting
  "0b05", // ASUS ROG
  "25a7", // Areson 2.4GHz
  "0c45", // Microdia / Royal Kludge
]);

function extractVidFromHidId(hidId: string): string {
  // Format: 0003:0000046D:0000C547
  const parts = hidId.split(":");
  if (parts.length < 2) return "";
  return parts[1].replace(/^0+/, "").padStart(4, "0").toLowerCase();
}

export function parseUsbHidrawDevices(
  entries: UsbHidrawSysfsEntry[],
): PeripheralDevice[] {
  const byPort = new Map<string, UsbHidrawSysfsEntry>();

  for (const entry of [...entries].sort((a, b) => (a.interfaceNumber ?? 255) - (b.interfaceNumber ?? 255))) {
    const physLower = entry.hidPhys.trim().toLowerCase();
    if (!physLower.startsWith("usb-")) continue;

    const nameLower = entry.hidName.trim().toLowerCase();
    if (
      nameLower.includes("hub") ||
      nameLower.includes("webcam") ||
      nameLower.includes("camera") ||
      nameLower.includes("fingerprint") ||
      nameLower.includes("touchscreen") ||
      nameLower.includes("fido") ||
      nameLower.includes("yubikey") ||
      nameLower.includes("u2f")
    ) {
      continue;
    }

    const vid = extractVidFromHidId(entry.hidId);
    const isWirelessOrPeripheral =
      Boolean(entry.inputType) || KNOWN_PERIPHERAL_VIDS.has(vid) ||
      /2\.4g|wireless|dongle|receiver|lightspeed|unifying|bolt|slipstream|mouse|keyboard|headset|headphone|gamepad|controller|gaming|logitech|razer|steelseries|hyperx|corsair|keychron|vxe|attack|mchose|rapoo|pulsar|glorious/i.test(
        entry.hidName,
      );

    if (!isWirelessOrPeripheral) continue;

    const usbPortKey = `${physLower.split("/input")[0]}|${entry.hidId.toLowerCase()}`;
    if (!byPort.has(usbPortKey) || (!byPort.get(usbPortKey)?.inputType && entry.inputType)) {
      byPort.set(usbPortKey, entry);
    }
  }

  const out: PeripheralDevice[] = [];
  for (const entry of byPort.values()) {
    if (out.length >= 8) break;
    const devType = entry.inputType ?? inferDeviceTypeFromSysfs({
      name: entry.hidName,
      modelName: entry.hidName,
      scope: "Device",
    });
    const nameLower = entry.hidName.toLowerCase();
    const isWirelessDongle =
      /2\.4g|wireless|dongle|receiver|lightspeed|unifying|bolt|slipstream/i.test(
        nameLower,
      );
    const conn: ConnectionType = isWirelessDongle
      ? "usb_dongle_2_4ghz"
      : "wired_usb";
    const dev = buildBatteryDevice(
      out.length,
      devType,
      0,
      "unknown",
      conn,
      nameLower.includes("logitech") ||
        extractVidFromHidId(entry.hidId) === "046d"
        ? "hidpp"
        : nameLower.includes("razer")
          ? "razer_openrazer"
          : "upower_generic",
      entry.hidName || "USB 2.4GHz Device",
    );
    dev.batteryAvailable = false;
    dev.deviceId = `usb:${entry.hidPhys.toLowerCase().split("/input")[0]}|${entry.hidId.toLowerCase()}`;
    out.push(dev);
  }
  return out;
}

export function mergeLinuxDevices(
  sysfsDevices: PeripheralDevice[],
  upowerDevices: PeripheralDevice[],
): PeripheralDevice[] {
  const merged: PeripheralDevice[] = sysfsDevices.map((d) => ({ ...d }));
  for (const upDev of upowerDevices) {
    if (merged.length >= 8) break;

    if (upDev.batteryAvailable === false) {
      const covered = merged.some(ex => ex.batteryAvailable !== false &&
        ((ex.deviceId && ex.deviceId === upDev.deviceId) ||
         (ex.connectionType === upDev.connectionType && !isGenericLabel(ex.labelEn) && ex.labelEn === upDev.labelEn)));
      if (covered) continue;
      merged.push({
        ...upDev,
        slotId: SLOT_IDS[merged.length] ?? "slot_8",
      });
      continue;
    }

    const existing = merged.find((ex) => {
      if (ex.deviceId && upDev.deviceId) return ex.deviceId === upDev.deviceId;
      if (ex.batteryAvailable === false) return false;
      if (ex.type !== upDev.type) return false;
      if (Math.abs(ex.batteryPct - upDev.batteryPct) > 2) return false;
      if (ex.type !== "laptop" && ex.connectionType !== upDev.connectionType)
        return false;
      if (
        !isGenericLabel(ex.labelEn) &&
        !isGenericLabel(upDev.labelEn) &&
        ex.labelEn !== upDev.labelEn
      ) {
        return false;
      }
      return true;
    });
    if (existing) {
      existing.deviceId ??= upDev.deviceId;
      if (isGenericLabel(existing.labelEn) && !isGenericLabel(upDev.labelEn)) {
        existing.labelEn = upDev.labelEn;
        existing.labelMn = upDev.labelMn;
      }
      continue;
    }
    merged.push({
      ...upDev,
      slotId: SLOT_IDS[merged.length] ?? "slot_8",
    });
  }
  return merged.map((d, idx) => ({ ...d, slotId: SLOT_IDS[idx] ?? "slot_8" }));
}

function safeReadTrimmed(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

function parseUeventMap(ueventRaw: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of ueventRaw.split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) {
      map[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  return map;
}

export function readSysfsEntries(): SysfsPowerSupplyEntry[] {
  if (process.platform !== "linux") return [];
  const baseDir = "/sys/class/power_supply";
  try {
    if (!fs.existsSync(baseDir)) return [];
    const dirs = fs.readdirSync(baseDir);
    return dirs.map((name) => {
      const dir = path.join(baseDir, name);
      const uevent = parseUeventMap(safeReadTrimmed(path.join(dir, "uevent")));
      const devUevent = parseUeventMap(
        safeReadTrimmed(path.join(dir, "device", "uevent")),
      );
      let realPath = "";
      try {
        realPath = fs.realpathSync(dir);
      } catch {
        realPath = "";
      }
      const capStr =
        safeReadTrimmed(path.join(dir, "capacity")) ||
        uevent.POWER_SUPPLY_CAPACITY ||
        "";
      const capacity = capStr === "" ? NaN : Number(capStr);
      const modelName =
        safeReadTrimmed(path.join(dir, "model_name")) ||
        uevent.POWER_SUPPLY_MODEL_NAME ||
        safeReadTrimmed(path.join(dir, "device", "name")) ||
        devUevent.HID_NAME ||
        "";
      const energyFullRaw =
        safeReadTrimmed(path.join(dir, "energy_full")) ||
        safeReadTrimmed(path.join(dir, "charge_full")) ||
        uevent.POWER_SUPPLY_ENERGY_FULL ||
        uevent.POWER_SUPPLY_CHARGE_FULL ||
        "";
      const energyDesignRaw =
        safeReadTrimmed(path.join(dir, "energy_full_design")) ||
        safeReadTrimmed(path.join(dir, "charge_full_design")) ||
        uevent.POWER_SUPPLY_ENERGY_FULL_DESIGN ||
        uevent.POWER_SUPPLY_CHARGE_FULL_DESIGN ||
        "";
      const energyFull = energyFullRaw ? Number(energyFullRaw) : undefined;
      const energyFullDesign = energyDesignRaw
        ? Number(energyDesignRaw)
        : undefined;
      return {
        name,
        type:
          safeReadTrimmed(path.join(dir, "type")) ||
          uevent.POWER_SUPPLY_TYPE ||
          "",
        scope:
          safeReadTrimmed(path.join(dir, "scope")) ||
          uevent.POWER_SUPPLY_SCOPE ||
          "",
        modelName,
        manufacturer:
          safeReadTrimmed(path.join(dir, "manufacturer")) ||
          uevent.POWER_SUPPLY_MANUFACTURER ||
          "",
        hidPhys: devUevent.HID_PHYS || "",
        sysfsPath: realPath,
        capacity,
        capacityLevel:
          safeReadTrimmed(path.join(dir, "capacity_level")) ||
          uevent.POWER_SUPPLY_CAPACITY_LEVEL ||
          "",
        status:
          safeReadTrimmed(path.join(dir, "status")) ||
          uevent.POWER_SUPPLY_STATUS ||
          "",
        online:
          safeReadTrimmed(path.join(dir, "online")) ||
          uevent.POWER_SUPPLY_ONLINE ||
          "",
        energyFull,
        energyFullDesign,
      };
    });
  } catch {
    return [];
  }
}

export function probeLocalLinuxSysfs(): PeripheralDevice[] {
  return parseSysfsPowerSupply(readSysfsEntries());
}

export function probeLocalLinuxUpower(): LinuxPowerSnapshot {
  if (process.platform !== "linux")
    return { chargerConnected: false, devices: [] };
  try {
    const dump = execFileSync("upower", ["-d"], {
      encoding: "utf8",
      timeout: 1500,
    });
    return parseUpowerSnapshot(dump);
  } catch {
    return { chargerConnected: false, devices: [] };
  }
}

export function probeOpenRazerSysfs(): PeripheralDevice[] {
  if (process.platform !== "linux") return [];
  const drivers = ["razermouse", "razerkbd", "razerheadset", "razeraccessory"];
  const out: PeripheralDevice[] = [];
  for (const drv of drivers) {
    const base = path.join("/sys/bus/hid/drivers", drv);
    try {
      if (!fs.existsSync(base)) continue;
      for (const devDirName of fs.readdirSync(base)) {
        const devDir = path.join(base, devDirName);
        const levelRaw = safeReadTrimmed(path.join(devDir, "charge_level"));
        if (!levelRaw) continue;
        const level = Number(levelRaw);
        const statusRaw = safeReadTrimmed(path.join(devDir, "charge_status"));
        const deviceType =
          safeReadTrimmed(path.join(devDir, "device_type")) ||
          "Razer USB Device";
        const parsed = parseOpenRazerSysfsEntry({
          driver: drv,
          deviceType,
          chargeLevel: level,
          chargeStatus: statusRaw,
        });
        if (parsed) out.push(parsed);
      }
    } catch {
      // Ignore unavailable driver path
    }
  }
  return out;
}

export function probeHeadsetControl(): PeripheralDevice[] {
  if (process.platform !== "linux") return [];
  try {
    const rawJson = execFileSync("headsetcontrol", ["-b", "-o", "json"], {
      encoding: "utf8",
      timeout: 1200,
    });
    return parseHeadsetControlJson(rawJson);
  } catch {
    return [];
  }
}

export function probeUsbHidrawDevices(): PeripheralDevice[] {
  if (process.platform !== "linux") return [];
  const baseDir = "/sys/class/hidraw";
  try {
    if (!fs.existsSync(baseDir)) return [];
    const entries: UsbHidrawSysfsEntry[] = [];
    const names = lsusbNames();
    for (const hidrawName of fs.readdirSync(baseDir)) {
      const uevent = parseUeventMap(
        safeReadTrimmed(path.join(baseDir, hidrawName, "device", "uevent")),
      );
      if (!uevent.HID_PHYS) continue;
      entries.push({
        hidrawName,
        hidId: uevent.HID_ID || "",
        hidName: uevent.HID_NAME || names.get((uevent.HID_ID || "").split(":").slice(1).map(part => part.slice(-4).toLowerCase()).join(":")) || "",
        ...readUsbInterface(path.join(baseDir, hidrawName, "device")),
        hidPhys: uevent.HID_PHYS || "",
      });
    }
    return parseUsbHidrawDevices(entries);
  } catch {
    return [];
  }
}

export function probeLinuxPowerSnapshot(): LinuxPowerSnapshot {
  const sysfsEntries = readSysfsEntries();
  const sysfsDevices = parseSysfsPowerSupply(sysfsEntries);
  const upowerSnap = probeLocalLinuxUpower();
  const razerDevices = probeOpenRazerSysfs();
  const headsetDevices = probeHeadsetControl();
  const usbHidrawDevices = probeUsbHidrawDevices();

  let devices = mergeLinuxDevices(sysfsDevices, upowerSnap.devices);
  devices = mergeLinuxDevices(devices, razerDevices);
  devices = mergeLinuxDevices(devices, headsetDevices);
  devices = mergeLinuxDevices(devices, usbHidrawDevices);
  for (const reading of probeAirPodsReadings()) {
    const index = devices.findIndex((d) => d.deviceId === reading.deviceId);
    if (index < 0 && devices.length >= 8) continue;
    const next = {
      ...buildBatteryDevice(
        index < 0 ? devices.length : index,
        "headset",
        reading.batteryPct,
        reading.charging ? "charging" : "discharging",
        "bluetooth",
        "other",
        reading.name,
      ),
      deviceId: reading.deviceId,
      batteryAvailable: true,
      batterySource: "kAirPods",
      batteryComponents: reading.components,
    };
    if (index >= 0) devices[index] = next;
    else devices.push(next);
  }

  enrichM220(devices);
  devices = applyConfirmedDeviceGroups(devices);
  const chargerConnected =
    detectSysfsChargerConnected(sysfsEntries) ||
    upowerSnap.chargerConnected ||
    devices.some(
      (d) => d.batteryAvailable !== false && d.chargingState === "charging",
    );

  return {
    chargerConnected,
    devices,
  };
}

export function probeLocalLinuxDevices(): PeripheralDevice[] {
  return probeLinuxPowerSnapshot().devices;
}

export function detectLinuxDistro(): LinuxDistro {
  if (process.platform !== "linux") return "other";
  const osRelease = safeReadTrimmed("/etc/os-release").toLowerCase();
  if (osRelease.includes("arch")) return "arch";
  if (osRelease.includes("ubuntu") || osRelease.includes("debian"))
    return "debian_ubuntu";
  if (osRelease.includes("fedora") || osRelease.includes("rhel"))
    return "fedora_rhel";
  if (osRelease.includes("suse")) return "opensuse";
  if (osRelease.includes("nixos")) return "nixos";
  return "other";
}

export function detectHostEnvironment(): HostEnvironmentInfo {
  const isWin = process.platform === "win32";
  const osName: OsPlatform = isWin ? "windows" : "linux";

  let displayServer: DisplayServer = "unknown";
  if (isWin) {
    displayServer = "win32";
  } else if (process.env.WAYLAND_DISPLAY) {
    displayServer = "wayland";
  } else if (process.env.DISPLAY) {
    displayServer = "x11";
  }

  const probed = probeLocalLinuxDevices();
  const rssMb =
    Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;

  return {
    os: osName,
    displayServer,
    distro: detectLinuxDistro(),
    sysfsDeviceCount: probed.length,
    memoryRssMb: rssMb,
  };
}
