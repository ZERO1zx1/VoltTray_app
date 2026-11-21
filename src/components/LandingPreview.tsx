import { ArrowUpRight, Check, Shield, Terminal, Zap } from "lucide-react";
import type { Locale } from "../lib/types";

interface LandingPreviewProps {
  locale: Locale;
  onOpenDesktopDemo: () => void;
}

const LANDING_COPY = {
  en: {
    eyebrow: "WINDOWS & LINUX · TAURI V2 + RUST",
    title: "Every peripheral battery, one calm tray click away.",
    subtitle:
      "VoltTray sits quietly in your system tray and reads real battery levels from your laptop, Bluetooth headphones, and 2.4GHz wireless peripherals—with zero background bloat, zero telemetry, and strict read-only safety.",
    ctaPrimary: "Try Live Tray Demo",
    ctaSecondary: "View Source on GitHub",
    facts: ["MIT Open Source", "Read-Only Hardware Probing", "EN & MN Native UI"],
    featTitle: "Built like a native system utility",
    featSub:
      "No vendor bloatware suites, no cloud accounts, and no risky device writes.",
    features: [
      {
        tag: "01 / BACKGROUND ALERTS",
        title: "Hysteresis low-battery alerts",
        body: "Alerts run directly in the Rust tray daemon—even while the popup is closed—using a +5% hysteresis band so notifications never spam at the threshold.",
      },
      {
        tag: "02 / STRICT READ-ONLY",
        title: "Zero firmware or LED writes",
        body: "VoltTray never alters DPI, RGB lighting, volume, or charge limits. Linux udev rules are strictly scoped to vendor HID telemetry interfaces—never keyboard input nodes.",
      },
      {
        tag: "03 / LOCAL-FIRST",
        title: "Offline & zero telemetry",
        body: "Only your four preferences (language, alerts, threshold, launch at login) are saved locally in state.json. Zero analytics SDKs, zero outbound requests.",
      },
    ],
    provTitle: "Verified hardware providers",
    provSub:
      "VoltTray reads standard OS interfaces first, then enriches supported peripherals without guessing missing percentages.",
    cols: ["Platform", "Data Source", "Devices Covered"],
    rows: [
      [
        "Linux",
        "/sys/class/power_supply & UPower",
        "Laptop battery + health %, HID++ mice/keyboards, Bluetooth BAS",
      ],
      [
        "Linux",
        "OpenRazer & HeadsetControl",
        "Supported Razer mice/keyboards and USB wireless headsets",
      ],
      [
        "Linux",
        "kAirPods D-Bus & M220 HID",
        "AirPods Left/Right/Case levels; Valkyrie VK M3 Lite 2.4GHz mouse",
      ],
      [
        "Windows",
        "Win32_Battery & PnP DEVPKEY",
        "Laptop battery + WMI design health % and Windows BLE/HID devices",
      ],
    ],
    buildTitle: "Build from source",
    buildSub: "Requires Node.js 20+ and the Rust / Tauri v2 toolchain.",
    faqTitle: "Frequently asked questions",
    faqs: [
      {
        q: 'Why does my wired keyboard show “—” instead of 0%?',
        a: "Wired devices without a battery do not report telemetry. VoltTray explicitly marks them as connected with no battery reading rather than faking 0% or triggering false alerts.",
      },
      {
        q: "Can VoltTray set an 80% laptop charge limit or change RGB?",
        a: "No. VoltTray is strictly read-only by design. Charge thresholds and LED settings remain under your OS or manufacturer firmware controls.",
      },
    ],
    footerLeft: "VoltTray · MIT License · Rebuilt original landing (32 KB)",
    footerRight: "Local-first desktop utility · Windows & Linux",
  },
  mn: {
    eyebrow: "WINDOWS БА LINUX · TAURI V2 + RUST",
    title: "Бүх төхөөрөмжийн цэнэг трэй дээр нэг товшилтоор.",
    subtitle:
      "VoltTray нь таны зөөврийн компьютер, Bluetooth чихэвч болон 2.4GHz утасгүй төхөөрөмжийн бодит цэнэгийг системийн трэй дотроос харуулна—нэмэлт ачаалалгүй, телеметригүй, зөвхөн унших аюулгүй горимтой.",
    ctaPrimary: "Десктоп загвар турших",
    ctaSecondary: "GitHub эх код харах",
    facts: ["MIT Нээлттэй Эх", "Зөвхөн унших горим", "EN ба MN дэмжлэг"],
    featTitle: "Системийн жинхэнэ хэрэгсэл шиг хийгдсэн",
    featSub:
      "Хүнд драйверын багцгүй, үүлэн бүртгэлгүй, төхөөрөмж рүү эрсдэлтэй бичилт хийхгүй.",
    features: [
      {
        tag: "01 / BACKGROUND МЭДЭГДЭЛ",
        title: "Цонх хаалттай үед ч анхааруулна",
        body: "Бага цэнэгийн хяналт Rust background хэсэгт шууд ажиллаж, +5% гистерезис ашигласнаар босго орчимд давтан мэдэгдэл илгээхгүй.",
      },
      {
        tag: "02 / ЗӨВХӨН УНШИХ",
        title: "Firmware болон LED өөрчлөхгүй",
        body: "DPI, RGB гэрэл, дууны түвшин болон цэнэгийн хязгаарт хүрэхгүй. Linux udev дүрэм зөвхөн тухайн vendor HID интерфэйсэд хязгаарлагдсан.",
      },
      {
        tag: "03 / ЛОКАЛ БА НУУЦЛАЛ",
        title: "Офлайн ба телеметригүй",
        body: "Зөвхөн 4 тохиргоо (хэл, мэдэгдэл, босго, авто эхлэл) таны диск дээрх state.json файлд хадгалагдана. Гадагш ямар ч хүсэлт илгээхгүй.",
      },
    ],
    provTitle: "Баталгаажсан төхөөрөмжийн эх сурвалжууд",
    provSub:
      "Эхлээд үйлдлийн системийн стандарт сувгийг уншиж, цэнэгийн мэдээлэлгүй төхөөрөмжид хуурамч хувь зохиож харуулахгүй.",
    cols: ["Систем", "Эх сурвалж", "Дэмжих төхөөрөмж"],
    rows: [
      [
        "Linux",
        "/sys/class/power_supply & UPower",
        "Зөөврийн компьютерын батарей + эрүүл мэнд %, HID++, Bluetooth BAS",
      ],
      [
        "Linux",
        "OpenRazer & HeadsetControl",
        "OpenRazer дэмжлэгтэй Razer хулгана/гар болон USB чихэвч",
      ],
      [
        "Linux",
        "kAirPods D-Bus & M220 HID",
        "AirPods зүүн/баруун/кейс хувь; Valkyrie VK M3 Lite 2.4GHz хулгана",
      ],
      [
        "Windows",
        "Win32_Battery & PnP DEVPKEY",
        "Компьютерын батарей + WMI эрүүл мэнд % болон Windows BLE/HID төхөөрөмж",
      ],
    ],
    buildTitle: "Эх кодоос угсрах",
    buildSub: "Node.js 20+ болон Rust / Tauri v2 орчин шаардлагатай.",
    faqTitle: "Түгээмэл асуултууд",
    faqs: [
      {
        q: "Яагаад утастай гар дээр 0% биш “—” гэж харагдаж байна вэ?",
        a: "Батарейгүй утастай төхөөрөмж цэнэгийн мэдээлэл дамжуулдаггүй. VoltTray үүнийг 0% гэж андуурч анхааруулахын оронд цэнэгийн мэдээлэлгүй гэдгийг тодорхой харуулдаг.",
      },
      {
        q: "VoltTray 80% цэнэгийн хязгаар эсвэл RGB тохируулж чадах уу?",
        a: "Үгүй. VoltTray нь аюулгүй байдлын үүднээс зөвхөн унших горимтой. Цэнэгийн хязгаар болон LED тохиргоог системийн үндсэн хэрэгслээр удирдана.",
      },
    ],
    footerLeft: "VoltTray · MIT Лиценз · Шинээр бүтээсэн эх хуудас (32 KB)",
    footerRight: "Локал десктоп хэрэгсэл · Windows ба Linux",
  },
} as const;

export function LandingPreview({
  locale,
  onOpenDesktopDemo,
}: LandingPreviewProps) {
  const copy = LANDING_COPY[locale];

  return (
    <div className="bg-[#0B0F14] text-[#F1F5F9]">
      {/* Hero */}
      <section className="border-b border-white/[0.07] py-16 lg:py-20">
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-12 px-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="font-mono text-[12px] font-semibold tracking-[0.08em] text-[#22C55E]">
              {copy.eyebrow}
            </p>
            <h1 className="mt-4 text-[34px] font-bold leading-[1.08] tracking-[-0.03em] text-[#F1F5F9] sm:text-[46px]">
              {copy.title}
            </h1>
            <p className="mt-4 max-w-[540px] text-[16px] leading-relaxed text-[#94A3B8]">
              {copy.subtitle}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onOpenDesktopDemo}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#22C55E] px-4 text-[14px] font-semibold text-[#04140A] transition-colors hover:bg-[#16A34A]"
              >
                <Zap className="h-4 w-4" />
                <span>{copy.ctaPrimary}</span>
              </button>
              <a
                href="https://github.com/ZERO1zx1/VoltTray_app"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-[#111720] px-4 text-[14px] font-semibold text-[#F1F5F9] transition-colors hover:border-white/25 hover:bg-[#17202C]"
              >
                <span>{copy.ctaSecondary}</span>
                <ArrowUpRight className="h-4 w-4 text-[#94A3B8]" />
              </a>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[12px] text-[#64748B]">
              {copy.facts.map((fact) => (
                <li key={fact} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#22C55E]" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Crisp Static Preview of Real Tray Popup */}
          <aside className="mx-auto w-full max-w-[392px] overflow-hidden rounded-xl border border-white/15 bg-[#0B0F14] shadow-[0_28px_60px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#0D1219] px-3.5 py-2.5 text-[13px] font-semibold">
              <span>VoltTray</span>
              <span className="font-mono text-[11px] text-[#64748B]">400 × 480</span>
            </div>
            <div className="space-y-2 p-3">
              <div className="rounded-lg border border-white/[0.07] bg-[#111720] px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">
                    {locale === "mn" ? "Компьютерын батарей" : "System Battery"}
                  </span>
                  <span className="font-mono text-[13px] font-semibold text-[#22C55E] tabular-nums">
                    86%
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-[#94A3B8]">
                  {locale === "mn"
                    ? "Систем · Цэнэглэж байна · Эрүүл мэнд 94%"
                    : "System · Charging · Health 94%"}
                </div>
                <div className="mt-2 h-[3px] rounded-full bg-white/[0.08]">
                  <div className="h-full w-[86%] rounded-full bg-[#22C55E]" />
                </div>
              </div>

              <div className="rounded-lg border border-[#EF4444]/35 bg-[#111720] px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">Valkyrie VK M3 Lite</span>
                  <span className="font-mono text-[13px] font-semibold text-[#EF4444] tabular-nums">
                    18%
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-[#94A3B8]">
                  {locale === "mn"
                    ? "2.4GHz · Цэнэг бага · M220 HID"
                    : "2.4GHz · Low battery · M220 HID"}
                </div>
                <div className="mt-2 h-[3px] rounded-full bg-white/[0.08]">
                  <div className="h-full w-[18%] rounded-full bg-[#EF4444]" />
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.07] bg-[#111720] px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">AirPods Pro</span>
                  <span className="font-mono text-[13px] font-semibold text-[#F1F5F9] tabular-nums">
                    54%
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-[#94A3B8]">
                  {locale === "mn"
                    ? "Bluetooth · Батарейгаар · kAirPods"
                    : "Bluetooth · On battery · kAirPods"}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-white/[0.06] pt-2 text-[10px] text-[#94A3B8]">
                  <div className="rounded bg-[#0B0F14] px-2 py-1">
                    {locale === "mn" ? "Зүүн" : "Left"}
                    <strong className="mt-0.5 block font-mono text-[12px] text-[#F1F5F9]">
                      54%
                    </strong>
                  </div>
                  <div className="rounded bg-[#0B0F14] px-2 py-1">
                    {locale === "mn" ? "Баруун" : "Right"}
                    <strong className="mt-0.5 block font-mono text-[12px] text-[#F1F5F9]">
                      62%
                    </strong>
                  </div>
                  <div className="rounded bg-[#0B0F14] px-2 py-1">
                    {locale === "mn" ? "Кейс" : "Case"}
                    <strong className="mt-0.5 block font-mono text-[12px] text-[#22C55E]">
                      91%
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Architecture */}
      <section className="border-b border-white/[0.07] py-16">
        <div className="mx-auto max-w-[1120px] px-6">
          <div className="max-w-[620px]">
            <h2 className="text-[28px] font-bold tracking-[-0.025em]">
              {copy.featTitle}
            </h2>
            <p className="mt-2 text-[15px] text-[#94A3B8]">{copy.featSub}</p>
          </div>

          <div className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-3">
            {copy.features.map((f) => (
              <article
                key={f.tag}
                className="rounded-xl border border-white/[0.07] bg-[#111720] p-6"
              >
                <div className="font-mono text-[11px] font-semibold text-[#22C55E]">
                  {f.tag}
                </div>
                <h3 className="mt-3 text-[16px] font-semibold text-[#F1F5F9]">
                  {f.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#94A3B8]">
                  {f.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Providers Table */}
      <section className="border-b border-white/[0.07] py-16">
        <div className="mx-auto max-w-[1120px] px-6">
          <div className="max-w-[640px]">
            <h2 className="text-[28px] font-bold tracking-[-0.025em]">
              {copy.provTitle}
            </h2>
            <p className="mt-2 text-[15px] text-[#94A3B8]">{copy.provSub}</p>
          </div>

          <div className="mt-8 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#111720]">
            <table className="w-full border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-white/[0.07] bg-[#0D1219] font-mono text-[11px] uppercase tracking-wider text-[#64748B]">
                  {copy.cols.map((col) => (
                    <th key={col} className="px-5 py-3.5 font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {copy.rows.map(([os, source, devices]) => (
                  <tr key={`${os}-${source}`}>
                    <td className="px-5 py-3.5 font-medium text-[#F1F5F9]">{os}</td>
                    <td className="px-5 py-3.5 font-mono text-[12.5px] text-[#CBD5E1]">
                      {source}
                    </td>
                    <td className="px-5 py-3.5 text-[#94A3B8]">{devices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Build + FAQ */}
      <section className="border-b border-white/[0.07] py-16">
        <div className="mx-auto max-w-[1120px] px-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#22C55E]" />
                <h2 className="text-[22px] font-bold tracking-[-0.02em]">
                  {copy.buildTitle}
                </h2>
              </div>
              <p className="mt-1.5 text-[14px] text-[#94A3B8]">{copy.buildSub}</p>
              <pre className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#080B10] p-4 font-mono text-[12px] leading-relaxed text-[#CBD5E1]">
                <code>{`# Linux CLI Installer
curl -fsSL https://raw.githubusercontent.com/ZERO1zx1/VoltTray_app/main/scripts/install.sh | bash

# Windows PowerShell CLI
irm https://raw.githubusercontent.com/ZERO1zx1/VoltTray_app/main/scripts/install.ps1 | iex

# Local CLI (doctor / dry-run / install)
node scripts/cli.mjs doctor --lang mn`}</code>
              </pre>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#22C55E]" />
                <h2 className="text-[22px] font-bold tracking-[-0.02em]">
                  {copy.faqTitle}
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                {copy.faqs.map((faq) => (
                  <article
                    key={faq.q}
                    className="rounded-xl border border-white/[0.07] bg-[#111720] p-4"
                  >
                    <h3 className="text-[14.5px] font-semibold text-[#F1F5F9]">
                      {faq.q}
                    </h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#94A3B8]">
                      {faq.a}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 text-[12.5px] text-[#64748B]">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-6">
          <span>{copy.footerLeft}</span>
          <span>{copy.footerRight}</span>
        </div>
      </footer>
    </div>
  );
}
