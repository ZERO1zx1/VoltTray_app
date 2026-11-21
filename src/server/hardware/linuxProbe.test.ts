import test from "node:test";
import assert from "node:assert/strict";
import {
  detectSysfsChargerConnected,
  mergeLinuxDevices,
  parseHeadsetControlJson,
  parseOpenRazerSysfsEntry,
  parseSysfsPowerSupply,
  parseUpowerSnapshot,
  parseUsbHidrawDevices,
} from "./linuxProbe";

test("parseSysfsPowerSupply detects AC/USB-PD charger, system battery, and wireless/USB peripherals", () => {
  const entries = [
    {
      name: "ucsi-source-psy-USBC000:001",
      type: "USB_PD",
      scope: "System",
      modelName: "",
      capacity: Number.NaN,
      status: "Online",
      online: "1",
    },
    {
      name: "BAT0",
      type: "Battery",
      scope: "System",
      modelName: "LGC-L19L4",
      capacity: 84,
      status: "Discharging",
      energyFull: 47000000,
      energyFullDesign: 50000000,
    },
    {
      name: "hidpp_battery_0",
      type: "Battery",
      scope: "Device",
      modelName: "Superlight Wireless Mouse",
      hidPhys: "usb-0000:00:14.0-1/input0",
      capacity: 72,
      status: "Charging",
    },
    {
      name: "bluez_battery_1",
      type: "Battery",
      scope: "Device",
      modelName: "Arctis Headset",
      hidPhys: "hci0",
      capacity: 15,
      status: "Discharging",
    },
    {
      name: "hidpp_battery_1",
      type: "Battery",
      scope: "Device",
      modelName: "G915 Keyboard",
      capacity: Number.NaN,
      capacityLevel: "High",
      status: "Discharging",
    },
  ];

  assert.equal(detectSysfsChargerConnected(entries), true);

  const devices = parseSysfsPowerSupply(entries);
  assert.equal(devices.length, 4);
  assert.equal(devices[0].type, "laptop");
  assert.equal(devices[0].batteryPct, 84);
  assert.equal(devices[0].supportsHealth, true);
  assert.equal(devices[0].healthPct, 94);
  assert.equal(devices[1].type, "mouse");
  assert.equal(devices[1].labelEn, "Superlight Wireless Mouse");
  assert.equal(devices[1].batteryPct, 72);
  assert.equal(devices[1].chargingState, "charging");
  assert.equal(devices[1].connectionType, "wired_usb");
  assert.equal(devices[2].type, "headset");
  assert.equal(devices[2].connectionType, "bluetooth");
  assert.equal(devices[2].batteryPct, 15);
  assert.equal(devices[3].type, "keyboard");
  assert.equal(devices[3].batteryPct, 80);
});

test("parseUpowerSnapshot reads charger line_power, laptop battery, BlueZ headphones, USB phone, and HID battery", () => {
  const sampleDump = `
Device: /org/freedesktop/UPower/devices/line_power_AC
  native-path:          AC
  power supply:         yes
  line-power
    online:             yes

Device: /org/freedesktop/UPower/devices/battery_BAT0
  native-path:          BAT0
  power supply:         yes
  battery
    percentage:         81%
    state:              charging

Device: /org/freedesktop/UPower/devices/headset_dev_AA_BB_CC
  native-path:          /org/bluez/hci0/dev_AA_BB_CC
  model:                WH-1000XM5
  power supply:         no
  headphones
    present:            yes
    state:              discharging
    percentage:         45%

Device: /org/freedesktop/UPower/devices/mouse_hidpp_battery_0
  native-path:          hidpp_battery_0
  model:                G Pro X Superlight
  power supply:         no
  mouse
    present:            yes
    state:              charging
    percentage:         72%

Device: /org/freedesktop/UPower/devices/phone_usb_1
  native-path:          /devices/pci0000:00/usb1/1-2
  model:                Pixel 8
  power supply:         no
  phone
    present:            yes
    state:              charging
    percentage:         64%

Device: /org/freedesktop/UPower/devices/battery_hid_0003_046d
  native-path:          /devices/pci0000:00/usb1/1-3/input0
  model:                G915 TKL Keyboard
  power supply:         no
  battery
    present:            yes
    state:              discharging
    capacity-level:     high

Device: /org/freedesktop/UPower/devices/DisplayDevice
  power supply:         yes
  percentage:           81%
`;

  const snap = parseUpowerSnapshot(sampleDump);
  assert.equal(snap.chargerConnected, true);
  assert.equal(snap.devices.length, 5);
  assert.equal(snap.devices[0].type, "laptop");
  assert.equal(snap.devices[0].batteryPct, 81);
  assert.equal(snap.devices[1].type, "headset");
  assert.equal(snap.devices[1].connectionType, "bluetooth");
  assert.equal(snap.devices[1].batteryPct, 45);
  assert.equal(snap.devices[2].type, "mouse");
  assert.equal(snap.devices[2].batteryPct, 72);
  assert.equal(snap.devices[3].type, "other");
  assert.equal(snap.devices[3].labelEn, "Pixel 8");
  assert.equal(snap.devices[3].connectionType, "wired_usb");
  assert.equal(snap.devices[4].type, "keyboard");
  assert.equal(snap.devices[4].batteryPct, 80);

  // Deduplication with sysfs mouse at 72% (different connection/device types preserved)
  const sysfs = parseSysfsPowerSupply([
    {
      name: "hidpp_battery_0",
      type: "Battery",
      scope: "Device",
      modelName: "G Pro X Superlight",
      capacity: 72,
      status: "Charging",
    },
  ]);
  const merged = mergeLinuxDevices(sysfs, snap.devices);
  assert.equal(merged.length, 5);
});

test("charging Bluetooth keeps its transport and MAC identity; distinct identities do not merge", () => {
  const dump = `Device: /org/freedesktop/UPower/devices/headset_dev_AA_BB_CC_DD_EE_FF
  native-path: /org/bluez/hci0/dev_AA_BB_CC_DD_EE_FF
  model: AirPods
  headphones
    present: yes
    state: charging
    percentage: 45%`;
  const first = parseUpowerSnapshot(dump).devices[0];
  assert.equal(first.connectionType, "bluetooth");
  assert.equal(first.deviceId, "bluetooth:aa:bb:cc:dd:ee:ff");
  const second = { ...first, deviceId: "bluetooth:11:22:33:44:55:66" };
  assert.equal(mergeLinuxDevices([first], [second]).length, 2);
  assert.equal(
    mergeLinuxDevices([first], [{ ...first, batteryPct: 70 }]).length,
    1,
  );
});

test("parseOpenRazerSysfsEntry and parseHeadsetControlJson parse USB peripheral batteries", () => {
  const razer = parseOpenRazerSysfsEntry({
    driver: "razermouse",
    deviceType: "Razer Viper V2 Pro",
    chargeLevel: 128,
    chargeStatus: "0",
  });
  assert.ok(razer);
  assert.equal(razer.type, "mouse");
  assert.equal(razer.labelEn, "Razer Viper V2 Pro");
  assert.equal(razer.batteryPct, 50);
  assert.equal(razer.connectionType, "usb_dongle_2_4ghz");

  const hs = parseHeadsetControlJson(
    JSON.stringify({
      devices: [
        {
          device: "HyperX Cloud Alpha Wireless",
          battery: { status: "BATTERY_AVAILABLE", level: 88 },
        },
        {
          device: "Disconnected Dongle",
          battery: { status: "BATTERY_UNAVAILABLE", level: -1 },
        },
      ],
    }),
  );
  assert.equal(hs.length, 1);
  assert.equal(hs[0].type, "headset");
  assert.equal(hs[0].labelEn, "HyperX Cloud Alpha Wireless");
  assert.equal(hs[0].batteryPct, 88);
  assert.equal(hs[0].connectionType, "usb_dongle_2_4ghz");
});

test("USB boot interfaces classify DK68SE and XCTECH regardless of enumeration order", () => {
  const keyboard = { hidrawName: "hidraw3", hidId: "0003:0000258A:0000013B", hidName: "Sino Wealth DIERYA DK68SE", hidPhys: "usb-controller-3.3/input0", interfaceNumber: 0, inputType: "keyboard" as const };
  const mouse = { hidrawName: "hidraw0", hidId: "0003:0000249A:00005C2F", hidName: "XCTECH Wireless-Receiver", hidPhys: "usb-controller-1/input0", interfaceNumber: 0, inputType: "mouse" as const };
  const result = parseUsbHidrawDevices([
    { ...mouse, hidPhys: "usb-controller-1/input1", interfaceNumber: 1, inputType: "keyboard" },
    { ...keyboard, hidPhys: "usb-controller-3.3/input1", interfaceNumber: 1, inputType: undefined },
    keyboard, mouse,
  ]);
  const k = result.find(d => d.labelEn.includes("DK68SE"))!;
  const m = result.find(d => d.labelEn.includes("XCTECH"))!;
  assert.equal(result.length, 2);
  assert.equal(k.type, "keyboard");
  assert.equal(k.connectionType, "wired_usb");
  assert.equal(k.batteryAvailable, false);
  assert.equal(m.type, "mouse");
  assert.equal(m.connectionType, "usb_dongle_2_4ghz");
  // Another keyboard's battery must not hide this unrelated USB keyboard.
  assert.equal(mergeLinuxDevices([{ ...k, deviceId: "other-keyboard", labelEn: "Another Keyboard", batteryAvailable: true }], [k]).length, 2);
  const generic = parseUsbHidrawDevices([{ ...mouse, hidName: "Wireless Receiver", inputType: undefined }])[0];
  assert.equal(generic.type, "unknown");
});

test("parseUsbHidrawDevices discovers USB 2.4GHz dongles and avoids duplicating battery-reporting USB devices", () => {
  const dongles = parseUsbHidrawDevices([
    {
      hidrawName: "hidraw0",
      hidId: "0018:000004F3:0000311C",
      hidName: "ELAN1200:00 Touchpad",
      hidPhys: "i2c-ELAN1200:00",
    },
    {
      hidrawName: "hidraw1",
      hidId: "0003:00003554:0000F58E",
      hidName: "VXE R1 PRO 2.4G Wireless Mouse Receiver",
      hidPhys: "usb-0000:00:14.0-2/input0",
    },
    {
      hidrawName: "hidraw2",
      hidId: "0003:00003554:0000F58E",
      hidName: "VXE R1 PRO 2.4G Wireless Mouse Receiver",
      hidPhys: "usb-0000:00:14.0-2/input1",
    },
    {
      hidrawName: "hidraw3",
      hidId: "0003:0000046D:0000C547",
      hidName: "Logitech USB Receiver",
      hidPhys: "usb-0000:00:14.0-3/input0",
    },
  ]);

  assert.equal(dongles.length, 2);
  assert.equal(dongles[0].type, "mouse");
  assert.equal(dongles[0].labelEn, "VXE R1 PRO 2.4G Wireless Mouse Receiver");
  assert.equal(dongles[0].connectionType, "usb_dongle_2_4ghz");
  assert.equal(dongles[0].batteryAvailable, false);
  assert.equal(dongles[1].protocolDriver, "hidpp");

  // If Bluetooth headset + USB 2.4GHz mouse dongle are present, both remain; if USB mouse battery is known, hidraw mouse is skipped
  const btHeadsetSnap = parseUpowerSnapshot(`
Device: /org/freedesktop/UPower/devices/headset_dev_04_57_91_3F_7C_4A
  native-path:          /org/bluez/hci0/dev_04_57_91_3F_7C_4A
  model:                RB-660HB
  headphones
    percentage:         80%
`);
  const mergedWithBt = mergeLinuxDevices(btHeadsetSnap.devices, [dongles[0]]);
  assert.equal(mergedWithBt.length, 2);
  assert.equal(mergedWithBt[1].connectionType, "usb_dongle_2_4ghz");
  assert.equal(mergedWithBt[1].batteryAvailable, false);
});
