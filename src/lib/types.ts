export type Locale = "en" | "mn";

export type OsPlatform = "windows" | "linux";
export type DisplayServer = "win32" | "wayland" | "x11" | "unknown";
export type LinuxDistro =
  | "arch"
  | "debian_ubuntu"
  | "fedora_rhel"
  | "opensuse"
  | "nixos"
  | "other";

export type DeviceType =
  | "laptop"
  | "mouse"
  | "keyboard"
  | "headset"
  | "controller"
  | "other"
  | "unknown";

export type ConnectionType =
  | "wired_usb"
  | "bluetooth"
  | "usb_dongle_2_4ghz"
  | "unknown";

export type ChargingState =
  | "charging"
  | "discharging"
  | "full"
  | "paused_limit"
  | "unknown";

export type ProtocolDriver =
  | "hidpp"
  | "razer_openrazer"
  | "steelseries_hid"
  | "standard_ble_bas"
  | "upower_generic"
  | "m220_hid"
  | "kairpods_dbus"
  | "other";

export interface BatteryComponent {
  id: "left" | "right" | "case" | "headphone";
  batteryPct: number;
  charging: boolean;
}

export interface PeripheralDevice {
  /** Stable provider identity, independent of display slot order. */
  deviceId?: string;
  slotId: string;
  type: DeviceType;
  labelEn: string;
  labelMn: string;
  batteryPct: number;
  batteryAvailable?: boolean;
  chargingState: ChargingState;
  connectionType: ConnectionType;
  connectionTypes?: ConnectionType[];
  connected: boolean;
  batterySource?: string;
  batteryComponents?: BatteryComponent[];
  supportsHealth?: boolean;
  healthPct?: number;
  protocolDriver?: ProtocolDriver;
}

export type LowBatteryThreshold = 10 | 15 | 20;

export interface AppSettings {
  locale: Locale;
  notificationsEnabled: boolean;
  lowBatteryThresholdPct: LowBatteryThreshold;
  launchAtLogin: boolean;
}
