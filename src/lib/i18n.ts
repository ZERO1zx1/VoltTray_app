import type { BatteryComponent, Locale } from "./types";

export interface Dictionary {
  appName: string;
  header: {
    ariaLabel: string;
    sampleTag: string;
    refresh: string;
    settings: string;
    backToDevices: string;
    pin: string;
    unpin: string;
    close: string;
  };
  summary: {
    chargerConnected: string;
    chargerUnplugged: string;
    deviceCount: (count: number) => string;
  };
  states: {
    scanning: string;
    syncFailed: string;
    emptyTitle: string;
    emptyBody: string;
    scanDevices: string;
    samplePreview: string;
    exitSample: string;
  };
  device: {
    disconnected: string;
    batteryUnavailable: string;
    charging: string;
    full: string;
    pausedLimit: string;
    stateUnknown: string;
    onBattery: string;
    lowWarning: string;
    connectionLabel: string;
    sourceLabel: string;
    healthLabel: string;
    healthNote: string;
    componentsAria: string;
    components: Record<BatteryComponent["id"], string>;
    connections: {
      system: string;
      bluetooth: string;
      dongle: string;
      usb: string;
      unknown: string;
    };
  };
  settings: {
    title: string;
    language: string;
    alertsTitle: string;
    alertsDesc: string;
    thresholdLabel: string;
    autostartTitle: string;
    autostartDesc: string;
    pinTitle: string;
    pinDesc: string;
    readOnlyNote: string;
  };
  footer: {
    autostartShort: string;
    notUpdated: string;
    justNow: string;
    secondsAgo: (s: number) => string;
    minutesAgo: (m: number) => string;
  };
  notifications: {
    lowBatteryBody: string;
  };
}

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en: {
    appName: "VoltTray",
    header: {
      ariaLabel: "VoltTray battery monitor",
      sampleTag: "Sample",
      refresh: "Refresh hardware status",
      settings: "Open settings",
      backToDevices: "Back to devices",
      pin: "Pin window on top",
      unpin: "Unpin window",
      close: "Hide to system tray",
    },
    summary: {
      chargerConnected: "AC charger connected",
      chargerUnplugged: "Running on battery",
      deviceCount: (n) => `${n} ${n === 1 ? "device" : "devices"}`,
    },
    states: {
      scanning: "Scanning connected devices…",
      syncFailed: "Could not refresh hardware status. Showing last reading.",
      emptyTitle: "No battery devices detected",
      emptyBody:
        "Connect a wireless peripheral or charger, then scan again to read battery status.",
      scanDevices: "Scan devices",
      samplePreview: "View sample",
      exitSample: "Live scan",
    },
    device: {
      disconnected: "Disconnected",
      batteryUnavailable: "Connected · No battery telemetry",
      charging: "Charging",
      full: "Fully charged",
      pausedLimit: "Charging paused",
      stateUnknown: "Status unavailable",
      onBattery: "On battery",
      lowWarning: "Low battery",
      connectionLabel: "Connection",
      sourceLabel: "Source",
      healthLabel: "Battery health",
      healthNote: "Read-only monitor · Charge limits are managed by OS settings.",
      componentsAria: "Component battery levels",
      components: {
        left: "Left",
        right: "Right",
        case: "Case",
        headphone: "Headphones",
      },
      connections: {
        system: "System",
        bluetooth: "Bluetooth",
        dongle: "2.4GHz",
        usb: "USB",
        unknown: "Unknown",
      },
    },
    settings: {
      title: "Preferences",
      language: "Language",
      alertsTitle: "Low-battery alerts",
      alertsDesc: "Notify when a discharging device drops below threshold",
      thresholdLabel: "Alert threshold",
      autostartTitle: "Launch at login",
      autostartDesc: "Start minimized in the system tray on boot",
      pinTitle: "Keep window on top",
      pinDesc: "Pin the tray popup above other windows",
      readOnlyNote:
        "Local-first & read-only · VoltTray never modifies DPI, RGB, firmware, or sends data off-device.",
    },
    footer: {
      autostartShort: "Auto-start",
      notUpdated: "Not synced",
      justNow: "Just now",
      secondsAgo: (s) => `${s}s ago`,
      minutesAgo: (m) => `${m}m ago`,
    },
    notifications: {
      lowBatteryBody: "Low battery — connect your charger soon.",
    },
  },
  mn: {
    appName: "VoltTray",
    header: {
      ariaLabel: "VoltTray батарей хянагч",
      sampleTag: "Жишээ",
      refresh: "Төхөөрөмж дахин шалгах",
      settings: "Тохиргоо нээх",
      backToDevices: "Жагсаалт руу буцах",
      pin: "Цонхыг дээр бэхлэх",
      unpin: "Бэхэлгээ арилгах",
      close: "Трэй рүү нуух",
    },
    summary: {
      chargerConnected: "Цэнэглэгч залгагдсан",
      chargerUnplugged: "Батарейгаар ажиллаж байна",
      deviceCount: (n) => `${n} төхөөрөмж`,
    },
    states: {
      scanning: "Төхөөрөмжүүдийг шалгаж байна…",
      syncFailed: "Шинэчилж чадсангүй. Сүүлийн уншилтыг харуулж байна.",
      emptyTitle: "Батарейтай төхөөрөмж олдсонгүй",
      emptyBody:
        "Утасгүй төхөөрөмж эсвэл цэнэглэгчээ залгаад дахин шалгана уу.",
      scanDevices: "Дахин хайх",
      samplePreview: "Жишээ харах",
      exitSample: "Бодит шалгах",
    },
    device: {
      disconnected: "Холболт тасарсан",
      batteryUnavailable: "Холбогдсон · Цэнэгийн мэдээлэлгүй",
      charging: "Цэнэглэж байна",
      full: "Цэнэг дүүрсэн",
      pausedLimit: "Цэнэглэлт түр зогссон",
      stateUnknown: "Төлөв тодорхойгүй",
      onBattery: "Батарейгаар",
      lowWarning: "Цэнэг бага",
      connectionLabel: "Холболт",
      sourceLabel: "Эх сурвалж",
      healthLabel: "Батарейн эрүүл мэнд",
      healthNote:
        "Зөвхөн унших горим · Цэнэгийн хязгаарыг системийн тохиргооноос удирдана.",
      componentsAria: "Хэсэг тус бүрийн цэнэг",
      components: {
        left: "Зүүн",
        right: "Баруун",
        case: "Кейс",
        headphone: "Чихэвч",
      },
      connections: {
        system: "Систем",
        bluetooth: "Bluetooth",
        dongle: "2.4GHz",
        usb: "USB",
        unknown: "Тодорхойгүй",
      },
    },
    settings: {
      title: "Тохиргоо",
      language: "Хэл",
      alertsTitle: "Бага цэнэгийн мэдэгдэл",
      alertsDesc: "Цэнэг заасан босгоос доошлоход системээр анхааруулна",
      thresholdLabel: "Анхааруулах босго",
      autostartTitle: "Систем асахад хамт эхлэх",
      autostartDesc: "Нэвтрэх үед трэй дотор нуугдаж ажиллана",
      pinTitle: "Цонхыг дээр бэхлэх",
      pinDesc: "Бусад цонхны дээр тогтмол харуулна",
      readOnlyNote:
        "Локал ба зөвхөн унших горим · DPI, RGB, firmware өөрчлөхгүй, гадагш өгөгдөл илгээхгүй.",
    },
    footer: {
      autostartShort: "Авто эхлэл",
      notUpdated: "Шалгаагүй",
      justNow: "Саяхан",
      secondsAgo: (s) => `${s}с өмнө`,
      minutesAgo: (m) => `${m}м өмнө`,
    },
    notifications: {
      lowBatteryBody: "Цэнэг бага байна — цэнэглэгчээ залгана уу.",
    },
  },
};
