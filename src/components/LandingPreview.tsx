import { useState } from "react";
import {
  ArrowUpRight,
  BatteryCharging,
  Check,
  ChevronDown,
  Copy,
  Headphones,
  Keyboard,
  Laptop,
  Mouse,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import deskHardwareImg from "../assets/images/volttray_desk_hardware_1795276897665.jpg";
import { INITIAL_DEVICES } from "../lib/defaults";
import type { Locale } from "../lib/types";
import { DeviceRow } from "./DeviceRow";

interface LandingPreviewProps {
  locale: Locale;
  onOpenDesktopDemo: () => void;
}

type ProviderFilter = "all" | "linux" | "windows";
type InstallTab = "linux" | "windows" | "source";

const INSTALL_COMMANDS: Record<
  InstallTab,
  { labelEn: string; labelMn: string; command: string; noteEn: string; noteMn: string }
> = {
  linux: {
    labelEn: "Linux (curl)",
    labelMn: "Linux (curl)",
    command:
      "curl -fsSL https://raw.githubusercontent.com/ZERO1zx1/VoltTray_app/main/scripts/install.sh | bash",
    noteEn:
      "Installs the AppImage release into ~/.local/share/volttray with desktop icon and XDG autostart. Automatically falls back to local source build if needed.",
    noteMn:
      "~/.local/share/volttray руу AppImage хувилбарыг desktop icon болон XDG авто-асаалттай хамт суулгана. Release хараахан гараагүй бол эх кодоос автоматаар угсарна.",
  },
  windows: {
    labelEn: "Windows (PowerShell)",
    labelMn: "Windows (PowerShell)",
    command:
      "irm https://raw.githubusercontent.com/ZERO1zx1/VoltTray_app/main/scripts/install.ps1 | iex",
    noteEn:
      "Downloads the official Windows NSIS/MSI release from GitHub and configures minimized system tray startup.",
    noteMn:
      "GitHub Releases-ээс албан ёсны Windows NSIS/MSI инсталлерыг татаж, системийн трэй авто-асаалтыг тохируулна.",
  },
  source: {
    labelEn: "Node CLI / Source",
    labelMn: "Node CLI / Эх код",
    command:
      "git clone https://github.com/ZERO1zx1/VoltTray_app.git && cd VoltTray_app && npm install && npm run install:cli -- install --from-source --lang mn",
    noteEn:
      "Requires Node.js 20+, Rust, and Tauri v2 system libraries. Includes 'doctor' and '--dry-run' inspection flags.",
    noteMn:
      "Node.js 20+, Rust болон Tauri v2 сангууд шаардлагатай. 'doctor' болон '--dry-run' шалгах горимтой.",
  },
};

const LANDING_COPY = {
  en: {
    kicker: "Windows & Linux · Tauri v2 + Rust · MIT Open Source",
    title: "Every peripheral battery, one calm tray click away.",
    subtitle:
      "VoltTray lives quietly in your system tray and reads real battery levels from your laptop, Bluetooth earbuds, and 2.4GHz wireless mouse—with zero bloat, zero outbound telemetry, and strict read-only hardware safety.",
    ctaPrimary: "Try Live Tray Demo",
    ctaSecondary: "View Source on GitHub",
    quickCopyLabel: "Quick install",
    copied: "Copied",
    copy: "Copy",
    heroHint: "Click any device row to inspect live details",
    heroPopupMeta: "AC charger connected",
    heroPopupCount: "4 devices",
    heroPopupFooter: "Just now",
    heroPopupAutostart: "Auto-start",
    metrics: [
      { value: "400 × 480", label: "Frameless tray popup geometry" },
      { value: "0 B", label: "Outbound telemetry or cloud calls" },
      { value: "+5%", label: "Low-battery alert hysteresis band" },
      { value: "4 keys", label: "Persisted locally in state.json" },
    ],
    deskTitle: "One quiet readout for every device on your desk",
    deskSubtitle:
      "Instead of running separate 400 MB vendor suites for your mouse, keyboard, and audio, VoltTray reads native OS power interfaces directly.",
    deskCallouts: [
      {
        icon: "laptop" as const,
        name: "System Battery",
        source: "sysfs / Win32_Battery",
        reading: "84% · Health 94%",
      },
      {
        icon: "mouse" as const,
        name: "2.4GHz Wireless Mouse",
        source: "M220 HID (MI_02)",
        reading: "68% · On battery",
      },
      {
        icon: "headset" as const,
        name: "AirPods & Earbuds",
        source: "kAirPods D-Bus / BLE",
        reading: "L 18% · R 24% · Case 72%",
      },
      {
        icon: "keyboard" as const,
        name: "Wired Keyboards",
        source: "USB Boot HID",
        reading: "— · Honest no-telemetry",
      },
    ],
    bentoTitle: "Engineered like a native system utility",
    bentoSubtitle:
      "Every architectural choice prioritizes quiet reliability, transparent permissions, and honest readings.",
    c1Index: "01. Background daemon",
    c1Title: "Alerts that never spam at the threshold",
    c1Body:
      "Battery checks run inside the Rust system tray daemon even when the popup is hidden. Once a device triggers at 20%, alerts remain muted until it charges past 25% (+5% hysteresis) or connects to power.",
    c1Trigger: "Alert triggers <= 20%",
    c1Reset: "Resets above 25% (+5%)",
    c2Index: "02. Strict read-only",
    c2Title: "Zero firmware, LED, or input writes",
    c2Body:
      "Linux udev rules are strictly scoped to vendor telemetry interface MI_02—never broad keyboard hidraw nodes.",
    c2ReadsLabel: "Reads only",
    c2Reads: [
      "OS power_supply & UPower",
      "Win32_Battery & WMI health",
      "Bluetooth BAS & kAirPods",
      "Scoped M220 MI_02 report",
    ],
    c2BlocksLabel: "Never modifies",
    c2Blocks: [
      "Mouse DPI & polling rate",
      "RGB LED lighting profiles",
      "80% OS charge thresholds",
      "Firmware or audio EQ",
    ],
    c3Index: "03. Local-first state",
    c3Title: "Four preferences, zero cloud",
    c3Body:
      "No accounts, no analytics SDKs, no remote fonts. The entire persisted state on your machine is four JSON keys.",
    c4Index: "04. Verified hardware providers",
    c4Title: "Native OS interfaces first, zero guessed percentages",
    filterAll: "All",
    filterLinux: "Linux",
    filterWindows: "Windows",
    tableCols: ["Platform", "Data Source", "Devices Covered"],
    providers: [
      {
        os: "Linux" as const,
        key: "linux" as const,
        source: "/sys/class/power_supply & UPower",
        devices: "Laptop battery + health %, HID++ mice/keyboards, Bluetooth BAS",
      },
      {
        os: "Linux" as const,
        key: "linux" as const,
        source: "OpenRazer & HeadsetControl",
        devices: "Supported Razer peripherals and USB wireless headsets",
      },
      {
        os: "Linux" as const,
        key: "linux" as const,
        source: "kAirPods D-Bus & M220 HID",
        devices: "AirPods Left/Right/Case levels; Valkyrie VK M3 Lite 2.4GHz mouse",
      },
      {
        os: "Windows" as const,
        key: "windows" as const,
        source: "Win32_Battery & PnP DEVPKEY",
        devices: "Laptop battery + WMI design health % and Windows BLE/HID devices",
      },
    ],
    installTitle: "Install in one command",
    installSubtitle:
      "Choose your platform to install the native Tauri v2 desktop binary with system tray auto-start.",
    faqTitle: "Common engineering questions",
    faqs: [
      {
        q: 'Why does my wired keyboard show “—” instead of 0%?',
        a: "Wired peripherals without an internal battery do not expose battery telemetry. VoltTray marks them as connected with no battery reading rather than faking 0% or triggering false low-battery alerts.",
      },
      {
        q: "Can VoltTray set an 80% laptop charge limit or control RGB?",
        a: "No. VoltTray is strictly read-only by architecture. Charge thresholds, DPI, and RGB lighting stay safely under your operating system or firmware settings.",
      },
      {
        q: "Why does the Linux M220 udev rule only match bInterfaceNumber 02?",
        a: "Broad hidraw permissions expose keyboard input streams to user-space processes. Scoping 70-volttray-m220.rules strictly to interface 02 allows battery queries while keeping input interfaces locked down.",
      },
      {
        q: "Does VoltTray drain battery while sitting in the system tray?",
        a: "Closing the popup hides the WebView instead of rendering in the background. On Linux, upower --monitor reacts to hardware events rather than aggressive tight polling.",
      },
    ],
    footerCtaTitle: "Inspect every state before you install.",
    footerCtaSub:
      "Test low-battery hysteresis, AirPods component readouts, and tray hide behavior in the interactive workbench.",
    footerLeft: "VoltTray · MIT License · Local-first desktop utility",
    footerRight: "Windows & Linux · Zero Telemetry",
  },
  mn: {
    kicker: "Windows ба Linux · Tauri v2 + Rust · MIT Нээлттэй Эх",
    title: "Бүх төхөөрөмжийн цэнэг трэй дээр нэг товшилтоор.",
    subtitle:
      "VoltTray нь таны зөөврийн компьютер, Bluetooth чихэвч болон 2.4GHz утасгүй хулганын бодит цэнэгийг системийн трэй дотроос харуулна—нэмэлт ачаалалгүй, гадагш өгөгдөл илгээхгүй, зөвхөн унших аюулгүй горимтой.",
    ctaPrimary: "Десктоп загвар турших",
    ctaSecondary: "GitHub эх код харах",
    quickCopyLabel: "Шууд суулгах",
    copied: "Хууллаа",
    copy: "Хуулах",
    heroHint: "Дурын төхөөрөмж дээр дарж дэлгэрэнгүйг хараарай",
    heroPopupMeta: "Цэнэглэгч залгагдсан",
    heroPopupCount: "4 төхөөрөмж",
    heroPopupFooter: "Саяхан",
    heroPopupAutostart: "Авто эхлэл",
    metrics: [
      { value: "400 × 480", label: "Хүрээгүй трэй цонхны хэмжээ" },
      { value: "0 B", label: "Гадагш илгээх телеметри ба хүсэлт" },
      { value: "+5%", label: "Бага цэнэгийн гистерезис зурвас" },
      { value: "4 талбар", label: "state.json доторх локал тохиргоо" },
    ],
    deskTitle: "Ширээн дээрх бүх төхөөрөмжид нэг л цэвэр хянагч",
    deskSubtitle:
      "Хулгана, гар, чихэвч бүрд 400 MB хүнд драйвер суулгахын оронд VoltTray үйлдлийн системийн үндсэн сувгаас бодит цэнэгийг шууд уншина.",
    deskCallouts: [
      {
        icon: "laptop" as const,
        name: "Компьютерын батарей",
        source: "sysfs / Win32_Battery",
        reading: "84% · Эрүүл мэнд 94%",
      },
      {
        icon: "mouse" as const,
        name: "2.4GHz утасгүй хулгана",
        source: "M220 HID (MI_02)",
        reading: "68% · Батарейгаар",
      },
      {
        icon: "headset" as const,
        name: "AirPods ба чихэвч",
        source: "kAirPods D-Bus / BLE",
        reading: "Зүүн 18% · Баруун 24% · Кейс 72%",
      },
      {
        icon: "keyboard" as const,
        name: "Утастай гар",
        source: "USB Boot HID",
        reading: "— · Хуурамч 0% гаргахгүй",
      },
    ],
    bentoTitle: "Системийн жинхэнэ хэрэгсэл шиг бүтээгдсэн",
    bentoSubtitle:
      "Архитектурын шийдэл бүр нам гүм найдвартай ажиллагаа, ил тод зөвшөөрөл, үнэн зөв уншилтад чиглэсэн.",
    c1Index: "01. Background хяналт",
    c1Title: "Босго орчимд давтан саад болохгүй мэдэгдэл",
    c1Body:
      "Цонх хаалттай үед ч Rust трэй процесс цэнэгийг хянана. 20%-д хүрч анхааруулсны дараа цэнэг 25%-иас дээш (+5% гистерезис) өсөх эсвэл цэнэглэгч залгах хүртэл дахин давтахгүй.",
    c1Trigger: "Анхааруулга <= 20%",
    c1Reset: "Дахин идэвхжих > 25% (+5%)",
    c2Index: "02. Зөвхөн унших горим",
    c2Title: "Firmware, LED, гарын оролтод хүрэхгүй",
    c2Body:
      "Linux udev дүрэм зөвхөн тухайн төхөөрөмжийн MI_02 телеметрийн сувагт хязгаарлагдсан — гарын hidraw төхөөрөмжид огт хандахгүй.",
    c2ReadsLabel: "Зөвхөн уншина",
    c2Reads: [
      "OS power_supply ба UPower",
      "Win32_Battery ба WMI эрүүл мэнд",
      "Bluetooth BAS ба kAirPods",
      "Хязгаарлагдмал M220 MI_02",
    ],
    c2BlocksLabel: "Хэзээ ч өөрчлөхгүй",
    c2Blocks: [
      "Хулганын DPI ба polling rate",
      "RGB гэрлийн тохиргоо",
      "80% цэнэгийн хязгаар",
      "Firmware болон дууны EQ",
    ],
    c3Index: "03. Локал хадгалалт",
    c3Title: "Ердөө 4 тохиргоо, үүлгүй",
    c3Body:
      "Бүртгэл шаардахгүй, аналитик SDK байхгүй, фонт хүртэл локал. Диск дээр зөвхөн 4 JSON талбар хадгалагдана.",
    c4Index: "04. Баталгаажсан эх сурвалжууд",
    c4Title: "Эхлээд системийн сувгийг уншина, хувь тааж зохиохгүй",
    filterAll: "Бүгд",
    filterLinux: "Linux",
    filterWindows: "Windows",
    tableCols: ["Систем", "Эх сурвалж", "Дэмжих төхөөрөмж"],
    providers: [
      {
        os: "Linux" as const,
        key: "linux" as const,
        source: "/sys/class/power_supply & UPower",
        devices: "Зөөврийн компьютерын батарей + эрүүл мэнд %, HID++, Bluetooth BAS",
      },
      {
        os: "Linux" as const,
        key: "linux" as const,
        source: "OpenRazer & HeadsetControl",
        devices: "OpenRazer дэмжлэгтэй Razer төхөөрөмж ба USB утасгүй чихэвч",
      },
      {
        os: "Linux" as const,
        key: "linux" as const,
        source: "kAirPods D-Bus & M220 HID",
        devices: "AirPods зүүн/баруун/кейс хувь; Valkyrie VK M3 Lite 2.4GHz хулгана",
      },
      {
        os: "Windows" as const,
        key: "windows" as const,
        source: "Win32_Battery & PnP DEVPKEY",
        devices: "Компьютерын батарей + WMI эрүүл мэнд % ба Windows BLE/HID төхөөрөмж",
      },
    ],
    installTitle: "Нэг командаар суулгах",
    installSubtitle:
      "Үйлдлийн системээ сонгоод Tauri v2 десктоп аппыг авто-асаалттай хамт суулгаарай.",
    faqTitle: "Түгээмэл техникийн асуултууд",
    faqs: [
      {
        q: "Яагаад утастай гар дээр 0% биш “—” гэж харагдаж байна вэ?",
        a: "Дотоод батарейгүй утастай төхөөрөмж цэнэгийн мэдээлэл дамжуулдаггүй. VoltTray үүнийг 0% гэж хуурамчаар харуулж анхааруулахын оронд цэнэгийн мэдээлэлгүй гэдгийг үнэнээр харуулдаг.",
      },
      {
        q: "VoltTray 80% цэнэгийн хязгаар эсвэл RGB гэрэл удирдаж чадах уу?",
        a: "Үгүй. VoltTray аюулгүй байдлын үүднээс бүхэлдээ зөвхөн унших горимтой. Цэнэгийн хязгаар, DPI болон LED тохиргоо үйлдлийн систем эсвэл үйлдвэрлэгчийн хэрэгсэлд үлдэнэ.",
      },
      {
        q: "Linux M220 udev дүрэм яагаад зөвхөн bInterfaceNumber 02 дээр таардаг вэ?",
        a: "Өргөн hidraw эрх нь гарын товчлуурын урсгалыг нээх эрсдэлтэй. 70-volttray-m220.rules зөвхөн 02-р интерфэйсэд зөвшөөрөл өгснөөр гарын оролтыг бүрэн хамгаалж, зөвхөн цэнэг уншина.",
      },
      {
        q: "Трэй дотор ажиллаж байхдаа цэнэг их зарцуулдаг уу?",
        a: "Цонхыг хаахад WebView нуугдаж GPU ачаалал тэг рүү ойртдог. Linux дээр upower --monitor үйл явдалд тулгуурлан ажилладаг тул CPU-д дарамт үүсгэхгүй.",
      },
    ],
    footerCtaTitle: "Суулгахаасаа өмнө бүх төлөвийг шууд туршаарай.",
    footerCtaSub:
      "Интерактив симулятор дээр бага цэнэгийн гистерезис, AirPods задаргаа, трэй рүү нуух горимыг шалгаж үзээрэй.",
    footerLeft: "VoltTray · MIT Лиценз · Локал десктоп хэрэгсэл",
    footerRight: "Windows ба Linux · Телеметригүй",
  },
} as const;

function CalloutIcon({ kind }: { kind: "laptop" | "mouse" | "headset" | "keyboard" }) {
  const cls = "h-4 w-4 shrink-0 text-[#22C55E]";
  switch (kind) {
    case "laptop":
      return <Laptop className={cls} strokeWidth={1.8} aria-hidden="true" />;
    case "mouse":
      return <Mouse className={cls} strokeWidth={1.8} aria-hidden="true" />;
    case "headset":
      return <Headphones className={cls} strokeWidth={1.8} aria-hidden="true" />;
    case "keyboard":
      return <Keyboard className={cls} strokeWidth={1.8} aria-hidden="true" />;
  }
}

export function LandingPreview({
  locale,
  onOpenDesktopDemo,
}: LandingPreviewProps) {
  const copy = LANDING_COPY[locale];
  const [expandedKey, setExpandedKey] = useState<string | null>(
    INITIAL_DEVICES[2].deviceId ?? null,
  );
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [installTab, setInstallTab] = useState<InstallTab>("linux");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [imageFailed, setImageFailed] = useState(false);

  const quickCmd = INSTALL_COMMANDS[installTab].command;

  const filteredProviders = copy.providers.filter((p) =>
    providerFilter === "all" ? true : p.key === providerFilter,
  );

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback if clipboard API is restricted in iframe
    }
    setCopiedId(id);
    window.setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 1_800);
  };

  return (
    <div className="bg-[#0B0F14] text-[#F1F5F9]">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden border-b border-white/[0.07] py-14 lg:py-20">
        {/* Subtle restrained architectural top glow — 60/30/10 neutral slate */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_65%_55%_at_72%_18%,rgba(34,197,94,0.08),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-[1140px] px-5 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Left Column: Proposition & Primary Action */}
            <div className="lg:col-span-7">
              <p className="text-[13px] font-medium text-[#94A3B8]">
                {copy.kicker}
              </p>

              <h1 className="mt-4 max-w-[600px] text-balance text-[34px] font-bold leading-[1.07] tracking-[-0.03em] text-[#F1F5F9] sm:text-[48px] lg:text-[52px]">
                {copy.title}
              </h1>

              <p className="mt-5 max-w-[540px] text-[15.5px] leading-[1.65] text-[#CBD5E1]">
                {copy.subtitle}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenDesktopDemo}
                  className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg bg-[#22C55E] px-5 text-[14px] font-semibold text-[#04140A] transition-colors hover:bg-[#16A34A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F14]"
                >
                  <Zap className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                  <span>{copy.ctaPrimary}</span>
                </button>

                <a
                  href="https://github.com/ZERO1zx1/VoltTray_app"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/[0.14] bg-[#111720] px-5 text-[14px] font-semibold text-[#F1F5F9] transition-colors hover:border-white/25 hover:bg-[#17202C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
                >
                  <span>{copy.ctaSecondary}</span>
                  <ArrowUpRight className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
                </a>
              </div>

              {/* Inline Quick CLI Copy Strip */}
              <div className="mt-7 max-w-[560px] rounded-xl border border-white/[0.09] bg-[#0D1219] p-2">
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-2 pb-2">
                  <div className="flex items-center gap-2 text-[12px] text-[#94A3B8]">
                    <Terminal className="h-3.5 w-3.5 text-[#22C55E]" aria-hidden="true" />
                    <span>{copy.quickCopyLabel}</span>
                  </div>
                  <div
                    role="tablist"
                    aria-label={copy.quickCopyLabel}
                    className="inline-flex rounded-md bg-[#0B0F14] p-0.5"
                  >
                    {(["linux", "windows"] as const).map((tab) => {
                      const active = installTab === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setInstallTab(tab)}
                          className={`whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            active
                              ? "bg-[#17202C] text-[#F1F5F9]"
                              : "text-[#94A3B8] hover:text-[#F1F5F9]"
                          }`}
                        >
                          {tab === "linux" ? "Linux" : "Windows"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 px-2 pt-2">
                  <code className="truncate font-mono text-[12px] text-[#CBD5E1]">
                    {quickCmd}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopy("hero", quickCmd)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-white/[0.1] bg-[#111720] px-2.5 text-[11.5px] font-medium text-[#E2E8F0] transition-colors hover:border-white/20 hover:bg-[#17202C]"
                  >
                    {copiedId === "hero" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#22C55E]" aria-hidden="true" />
                        <span className="text-[#22C55E]">{copy.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-[#94A3B8]" aria-hidden="true" />
                        <span>{copy.copy}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Live Tray Preview */}
            <div className="lg:col-span-5">
              <div className="mx-auto w-full max-w-[400px]">
                <div className="overflow-hidden rounded-xl border border-white/[0.14] bg-[#0B0F14] shadow-[0_28px_70px_rgba(0,0,0,0.6)]">
                  <div className="flex h-11 items-center justify-between border-b border-white/[0.07] bg-[#0D1219] px-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-[#22C55E]/15 text-[#22C55E]"
                        aria-hidden="true"
                      >
                        <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </span>
                      <span className="text-[13.5px] font-semibold tracking-[-0.015em] text-[#F1F5F9]">
                        VoltTray
                      </span>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-[#94A3B8]">
                      400 × 480
                    </span>
                  </div>

                  <div className="flex h-8 items-center justify-between border-b border-white/[0.05] px-3.5 text-[11px] text-[#CBD5E1]">
                    <span className="inline-flex items-center gap-1.5">
                      <BatteryCharging className="h-3.5 w-3.5 text-[#22C55E]" aria-hidden="true" />
                      {copy.heroPopupMeta}
                    </span>
                    <span className="font-mono tabular-nums text-[#94A3B8]">
                      {copy.heroPopupCount}
                    </span>
                  </div>

                  <div className="space-y-2 p-3">
                    {INITIAL_DEVICES.map((device) => {
                      const key = device.deviceId ?? device.slotId;
                      return (
                        <DeviceRow
                          key={key}
                          device={device}
                          locale={locale}
                          thresholdPct={20}
                          expanded={expandedKey === key}
                          onToggle={(k) =>
                            setExpandedKey((prev) => (prev === k ? null : k))
                          }
                        />
                      );
                    })}
                  </div>

                  <div className="flex h-8 items-center justify-between border-t border-white/[0.07] bg-[#0D1219] px-3.5 text-[10.5px] text-[#94A3B8]">
                    <span className="font-mono tabular-nums">{copy.heroPopupFooter}</span>
                    <span>{copy.heroPopupAutostart}</span>
                  </div>
                </div>
                <p className="mt-3 text-center text-[12px] text-[#94A3B8]">
                  {copy.heroHint}
                </p>
              </div>
            </div>
          </div>

          {/* 4-Column Quantitative Proof Strip (Full Width Below Hero Split) */}
          <dl className="mt-14 grid grid-cols-2 gap-6 border-t border-white/[0.08] pt-8 lg:grid-cols-4">
            {copy.metrics.map((item) => (
              <div key={item.label}>
                <dt className="font-mono text-[22px] font-semibold tracking-tight tabular-nums text-[#F1F5F9] sm:text-[26px]">
                  {item.value}
                </dt>
                <dd className="mt-1 text-[13px] leading-snug text-[#94A3B8]">
                  {item.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 2. Editorial Hardware Showcase (Generated 16:9 Studio Desk Photo) */}
      <section className="border-b border-white/[0.07] py-16 lg:py-20">
        <div className="mx-auto max-w-[1140px] px-5 sm:px-6">
          <div className="max-w-[660px]">
            <h2 className="text-balance text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-[#F1F5F9] sm:text-[34px]">
              {copy.deskTitle}
            </h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-[#94A3B8]">
              {copy.deskSubtitle}
            </p>
          </div>

          <div className="mt-9 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#111720]">
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0D1219]">
              {!imageFailed ? (
                <img
                  src={deskHardwareImg}
                  alt={
                    locale === "mn"
                      ? "Зөөврийн компьютер, утасгүй хулгана, механик гар болон утасгүй чихэвчтэй ажлын ширээ"
                      : "Minimal dark workstation desk with laptop, wireless mouse, compact mechanical keyboard, and wireless earbuds"
                  }
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,#17202C,#0B0F14)]">
                  <Laptop className="h-12 w-12 text-[#94A3B8]/40" aria-hidden="true" />
                </div>
              )}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-[#0B0F14]/25 to-transparent"
              />
            </div>

            {/* Hardware Source Callout Rail */}
            <div className="grid grid-cols-1 divide-y divide-white/[0.07] border-t border-white/[0.07] bg-[#0D1219] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
              {copy.deskCallouts.map((item) => (
                <div key={item.name} className="p-5">
                  <div className="flex items-center gap-2 text-[13.5px] font-semibold text-[#F1F5F9]">
                    <CalloutIcon kind={item.icon} />
                    <span>{item.name}</span>
                  </div>
                  <div className="mt-1.5 font-mono text-[11.5px] text-[#94A3B8]">
                    {item.source}
                  </div>
                  <div className="mt-2 font-mono text-[12px] font-medium tabular-nums text-[#E2E8F0]">
                    {item.reading}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Asymmetric Engineering Bento (7/5 + 5/7) */}
      <section className="border-b border-white/[0.07] py-16 lg:py-20">
        <div className="mx-auto max-w-[1140px] px-5 sm:px-6">
          <div className="max-w-[640px]">
            <h2 className="text-balance text-[26px] font-bold leading-[1.15] tracking-[-0.025em] text-[#F1F5F9] sm:text-[34px]">
              {copy.bentoTitle}
            </h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-[#94A3B8]">
              {copy.bentoSubtitle}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Card 01: Background Daemon + Visual Hysteresis Diagram (7 cols) */}
            <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#111720] p-6 sm:p-7 lg:col-span-7">
              <div>
                <div className="text-[12.5px] font-medium text-[#22C55E]">
                  {copy.c1Index}
                </div>
                <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-[#F1F5F9]">
                  {copy.c1Title}
                </h3>
                <p className="mt-2.5 max-w-[540px] text-[14.5px] leading-relaxed text-[#CBD5E1]">
                  {copy.c1Body}
                </p>
              </div>

              {/* Clean Technical Hysteresis Diagram */}
              <div className="mt-6 rounded-xl border border-white/[0.07] bg-[#0B0F14] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                  <span className="font-mono text-[#EF4444] tabular-nums">
                    {copy.c1Trigger}
                  </span>
                  <span className="font-mono text-[#22C55E] tabular-nums">
                    {copy.c1Reset}
                  </span>
                </div>
                <svg
                  viewBox="0 0 480 86"
                  className="mt-3 h-20 w-full"
                  role="img"
                  aria-label="Battery alert hysteresis diagram showing 20% trigger and 25% reset threshold"
                >
                  {/* +5% hysteresis band */}
                  <rect
                    x="0"
                    y="24"
                    width="480"
                    height="24"
                    fill="rgba(245, 158, 11, 0.08)"
                  />
                  {/* 25% Reset Line */}
                  <line
                    x1="0"
                    y1="24"
                    x2="480"
                    y2="24"
                    stroke="rgba(34, 197, 94, 0.55)"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  {/* 20% Trigger Line */}
                  <line
                    x1="0"
                    y1="48"
                    x2="480"
                    y2="48"
                    stroke="rgba(239, 68, 68, 0.65)"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  {/* Battery Discharge/Charge Curve */}
                  <path
                    d="M 10 14 L 110 28 L 165 56 L 230 34 L 275 52 L 365 14 L 465 14"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Single Alert Point */}
                  <circle cx="165" cy="56" r="5" fill="#EF4444" />
                  {/* Silenced Dip inside Hysteresis */}
                  <circle
                    cx="275"
                    cy="52"
                    r="4"
                    fill="#0B0F14"
                    stroke="#94A3B8"
                    strokeWidth="2"
                  />
                  {/* Reset Point */}
                  <circle cx="365" cy="14" r="5" fill="#22C55E" />
                </svg>
              </div>
            </article>

            {/* Card 02: Strict Read-Only Surface Audit (5 cols) */}
            <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#111720] p-6 sm:p-7 lg:col-span-5">
              <div>
                <div className="text-[12.5px] font-medium text-[#22C55E]">
                  {copy.c2Index}
                </div>
                <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-[#F1F5F9]">
                  {copy.c2Title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#CBD5E1]">
                  {copy.c2Body}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-white/[0.07] pt-5 sm:grid-cols-2">
                <div>
                  <div className="text-[12px] font-semibold text-[#22C55E]">
                    {copy.c2ReadsLabel}
                  </div>
                  <ul className="mt-2.5 space-y-1.5 text-[12.5px] text-[#E2E8F0]">
                    {copy.c2Reads.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-[#94A3B8]">
                    {copy.c2BlocksLabel}
                  </div>
                  <ul className="mt-2.5 space-y-1.5 text-[12.5px] text-[#94A3B8]">
                    {copy.c2Blocks.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>

            {/* Card 03: Local-First JSON Proof (5 cols) */}
            <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#111720] p-6 sm:p-7 lg:col-span-5">
              <div>
                <div className="text-[12.5px] font-medium text-[#22C55E]">
                  {copy.c3Index}
                </div>
                <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-[#F1F5F9]">
                  {copy.c3Title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#CBD5E1]">
                  {copy.c3Body}
                </p>
              </div>

              <pre className="mt-6 overflow-x-auto rounded-xl border border-white/[0.07] bg-[#0B0F14] p-4 font-mono text-[12px] leading-relaxed text-[#CBD5E1]">
                <code>{`{
  "settings": {
    "locale": "${locale}",
    "notificationsEnabled": true,
    "lowBatteryThresholdPct": 20,
    "launchAtLogin": true
  }
}`}</code>
              </pre>
            </article>

            {/* Card 04: Interactive Verified Hardware Providers Table (7 cols) */}
            <article className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#111720] p-6 sm:p-7 lg:col-span-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[12.5px] font-medium text-[#22C55E]">
                    {copy.c4Index}
                  </div>
                  <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-[#F1F5F9]">
                    {copy.c4Title}
                  </h3>
                </div>

                {/* Interactive Filter Tabs */}
                <div
                  role="tablist"
                  aria-label="Filter hardware providers by operating system"
                  className="inline-flex rounded-lg border border-white/[0.08] bg-[#0B0F14] p-0.5"
                >
                  {(
                    [
                      ["all", copy.filterAll],
                      ["linux", copy.filterLinux],
                      ["windows", copy.filterWindows],
                    ] as const
                  ).map(([key, label]) => {
                    const active = providerFilter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setProviderFilter(key)}
                        className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                          active
                            ? "bg-[#17202C] text-[#F1F5F9]"
                            : "text-[#94A3B8] hover:text-[#F1F5F9]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-xl border border-white/[0.07] bg-[#0B0F14]">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-white/[0.07] text-[11.5px] font-medium text-[#94A3B8]">
                      {copy.tableCols.map((col) => (
                        <th key={col} className="px-4 py-3 font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredProviders.map((row) => (
                      <tr key={`${row.os}-${row.source}`}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-[#F1F5F9]">
                          {row.os}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-[#E2E8F0]">
                          {row.source}
                        </td>
                        <td className="px-4 py-3 text-[#CBD5E1]">{row.devices}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 4. Interactive CLI Install & FAQ */}
      <section className="border-b border-white/[0.07] py-16 lg:py-20">
        <div className="mx-auto grid max-w-[1140px] grid-cols-1 gap-10 px-5 sm:px-6 lg:grid-cols-12">
          {/* Install Command Panel (6 cols) */}
          <div className="lg:col-span-6">
            <h2 className="text-[24px] font-bold tracking-[-0.025em] text-[#F1F5F9] sm:text-[28px]">
              {copy.installTitle}
            </h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[#94A3B8]">
              {copy.installSubtitle}
            </p>

            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#111720] p-5">
              <div
                role="tablist"
                aria-label={copy.installTitle}
                className="flex flex-wrap gap-1 rounded-lg border border-white/[0.07] bg-[#0B0F14] p-1"
              >
                {(["linux", "windows", "source"] as const).map((tab) => {
                  const active = installTab === tab;
                  const meta = INSTALL_COMMANDS[tab];
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setInstallTab(tab)}
                      className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-[12.5px] font-medium transition-colors ${
                        active
                          ? "bg-[#17202C] text-[#F1F5F9]"
                          : "text-[#94A3B8] hover:text-[#F1F5F9]"
                      }`}
                    >
                      {locale === "mn" ? meta.labelMn : meta.labelEn}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#0B0F14] p-4">
                <pre className="overflow-x-auto font-mono text-[12.5px] leading-relaxed text-[#E2E8F0]">
                  <code>{INSTALL_COMMANDS[installTab].command}</code>
                </pre>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                  <span className="text-[12px] text-[#94A3B8]">
                    {locale === "mn"
                      ? INSTALL_COMMANDS[installTab].noteMn
                      : INSTALL_COMMANDS[installTab].noteEn}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopy("install", INSTALL_COMMANDS[installTab].command)
                    }
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/[0.12] bg-[#111720] px-3.5 text-[12px] font-semibold text-[#F1F5F9] transition-colors hover:border-white/25 hover:bg-[#17202C]"
                  >
                    {copiedId === "install" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#22C55E]" aria-hidden="true" />
                        <span className="text-[#22C55E]">{copy.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-[#94A3B8]" aria-hidden="true" />
                        <span>{copy.copy}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive FAQ Accordion (6 cols) */}
          <div className="lg:col-span-6">
            <h2 className="text-[24px] font-bold tracking-[-0.025em] text-[#F1F5F9] sm:text-[28px]">
              {copy.faqTitle}
            </h2>

            <div className="mt-6 divide-y divide-white/[0.07] rounded-2xl border border-white/[0.08] bg-[#111720]">
              {copy.faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={faq.q}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq((curr) => (curr === idx ? -1 : idx))}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[14.5px] font-semibold text-[#F1F5F9] transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#22C55E]"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[#94A3B8] transition-transform duration-150 ${
                          isOpen ? "rotate-180 text-[#22C55E]" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-[13.5px] leading-relaxed text-[#CBD5E1]">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Closing Decision Band & Quiet Footer */}
      <section className="border-b border-white/[0.07] py-14">
        <div className="mx-auto flex max-w-[1140px] flex-col items-start justify-between gap-6 px-5 sm:px-6 md:flex-row md:items-center">
          <div className="max-w-[580px]">
            <h2 className="text-balance text-[24px] font-bold tracking-[-0.025em] text-[#F1F5F9] sm:text-[28px]">
              {copy.footerCtaTitle}
            </h2>
            <p className="mt-2 text-[14.5px] text-[#94A3B8]">
              {copy.footerCtaSub}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenDesktopDemo}
            className="inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#22C55E] px-5 text-[14px] font-semibold text-[#04140A] transition-colors hover:bg-[#16A34A]"
          >
            <Zap className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            <span>{copy.ctaPrimary}</span>
          </button>
        </div>
      </section>

      <footer className="py-8 text-[12.5px] text-[#94A3B8]">
        <div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-3 px-5 sm:px-6">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#22C55E]" aria-hidden="true" />
            <span>{copy.footerLeft}</span>
          </span>
          <span>{copy.footerRight}</span>
        </div>
      </footer>
    </div>
  );
}
