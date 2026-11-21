import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  PlugZap,
  ShieldCheck,
  Sliders,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import {
  deviceKey,
  evaluateLowBattery,
  hasBatteryReading,
} from "../lib/battery";
import { INITIAL_DEVICES } from "../lib/defaults";
import { DICTIONARIES } from "../lib/i18n";
import type { AppSettings, Locale, PeripheralDevice } from "../lib/types";
import { TrayWidget } from "./TrayWidget";

type ScenarioId = "connected" | "low" | "empty" | "error";

interface DesktopWorkbenchProps {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

interface ToastAlert {
  id: string;
  title: string;
  body: string;
}

const WORKBENCH_COPY: Record<
  Locale,
  {
    simTitle: string;
    simSub: string;
    scenariosLabel: string;
    scenarios: Record<ScenarioId, string>;
    acPower: string;
    controlsHint: string;
    chargingBtn: string;
    dischargingBtn: string;
    trayHiddenTitle: string;
    trayHiddenAction: string;
    trayTooltip: string;
    toastLabel: string;
    fixesTitle: string;
    fixes: { tag: string; text: string }[];
  }
> = {
  en: {
    simTitle: "Hardware Simulator",
    simSub:
      "Test real TrayWidget states, hysteresis low-battery alerts (+5%), and native tray hide/restore behavior.",
    scenariosLabel: "Scenario",
    scenarios: {
      connected: "Connected (4)",
      low: "Low Battery",
      empty: "Empty",
      error: "Sync Error",
    },
    acPower: "AC Charger",
    controlsHint: "Drag battery sliders below threshold to trigger native alert",
    chargingBtn: "Charging",
    dischargingBtn: "Battery",
    trayHiddenTitle: "VoltTray is running quietly in the system tray.",
    trayHiddenAction: "Open Tray Popup",
    trayTooltip: "Click to toggle VoltTray (400 × 480)",
    toastLabel: "OS Notification",
    fixesTitle: "Desktop Architecture Highlights",
    fixes: [
      {
        tag: "RUST DAEMON",
        text: "Low-battery alerts now fire in background Rust threads even when the window is hidden.",
      },
      {
        tag: "SECURITY",
        text: "Removed broad keyboard hidraw udev rule; kept strict M220 interface-02 scope only.",
      },
      {
        tag: "ORIGINAL UI",
        text: "Rebuilt landing (43 MB → 32 KB) and unified dark slate tokens with zero ghost fields.",
      },
    ],
  },
  mn: {
    simTitle: "Төхөөрөмжийн симулятор",
    simSub:
      "TrayWidget-ийн бүх төлөв, +5% гистерезис бага цэнэгийн анхааруулга болон трэй рүү нуух үйлдлийг шууд шалгаарай.",
    scenariosLabel: "Төлөв сонгох",
    scenarios: {
      connected: "4 төхөөрөмж",
      low: "Бага цэнэг",
      empty: "Хоосон",
      error: "Синк алдаа",
    },
    acPower: "Цэнэглэгч (AC)",
    controlsHint:
      "Цэнэгийн гулсуурыг босгоос доош татаж системийн мэдэгдлийг шалгана уу",
    chargingBtn: "Цэнэглэж буй",
    dischargingBtn: "Батарей",
    trayHiddenTitle: "VoltTray системийн трэй дотор чимээгүй ажиллаж байна.",
    trayHiddenAction: "Трэй цонх нээх",
    trayTooltip: "VoltTray цонхыг нээх / нуух (400 × 480)",
    toastLabel: "Системийн мэдэгдэл",
    fixesTitle: "Гол шинэчлэлтүүд",
    fixes: [
      {
        tag: "RUST DAEMON",
        text: "Цонх хаалттай үед ч Rust background урсгалаас бага цэнэгийн анхааруулга илгээнэ.",
      },
      {
        tag: "АЮУЛГҮЙ БАЙДАЛ",
        text: "Гарт ханддаг өргөн hidraw udev дүрмийг устгаж, зөвхөн M220 interface-02-оор хязгаарласан.",
      },
      {
        tag: "ШИНЭЭР БҮТЭЭСЭН",
        text: "Хуулсан 43 MB landing-ийг 32 KB эх кодоор дахин бүтээж, илүүдэл талбаруудыг цэвэрлэсэн.",
      },
    ],
  },
};

function makeScenarioDevices(id: ScenarioId): {
  devices: PeripheralDevice[];
  charger: boolean;
  syncError: boolean;
} {
  if (id === "empty") {
    return { devices: [], charger: false, syncError: false };
  }
  if (id === "low") {
    return {
      charger: false,
      syncError: false,
      devices: INITIAL_DEVICES.map((d, idx) => {
        if (idx === 0) return { ...d, batteryPct: 42, chargingState: "discharging" };
        if (idx === 1) return { ...d, batteryPct: 14, chargingState: "discharging" };
        if (idx === 2) return { ...d, batteryPct: 18, chargingState: "discharging" };
        return { ...d };
      }),
    };
  }
  if (id === "error") {
    return {
      charger: true,
      syncError: true,
      devices: INITIAL_DEVICES.map((d) => ({ ...d })),
    };
  }
  return {
    charger: true,
    syncError: false,
    devices: INITIAL_DEVICES.map((d) => ({ ...d })),
  };
}

export function DesktopWorkbench({
  settings,
  onUpdateSettings,
}: DesktopWorkbenchProps) {
  const [scenario, setScenario] = useState<ScenarioId>("connected");
  const [devices, setDevices] = useState<PeripheralDevice[]>(() =>
    makeScenarioDevices("connected").devices,
  );
  const [chargerConnected, setChargerConnected] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [windowOpen, setWindowOpen] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(() => Date.now());
  const [toast, setToast] = useState<ToastAlert | null>(null);

  const alertedRef = useRef<Set<string>>(new Set());
  const copy = WORKBENCH_COPY[settings.locale];
  const widgetDict = DICTIONARIES[settings.locale];

  // Run the real hysteresis low-battery engine against simulated devices
  useEffect(() => {
    const triggered = evaluateLowBattery(devices, settings, alertedRef.current);
    if (triggered.length > 0) {
      const first = triggered[0];
      const name = settings.locale === "mn" ? first.labelMn : first.labelEn;
      setToast({
        id: `${deviceKey(first)}-${Date.now()}`,
        title: `${name} (${Math.round(first.batteryPct)}%)`,
        body: widgetDict.notifications.lowBatteryBody,
      });
    }
  }, [devices, settings, widgetDict.notifications.lowBatteryBody]);

  // Auto-dismiss OS toast after 6s
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6_000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const applyScenario = (next: ScenarioId) => {
    alertedRef.current.clear();
    setToast(null);
    setScenario(next);
    setSampleMode(false);
    const data = makeScenarioDevices(next);
    setDevices(data.devices);
    setChargerConnected(data.charger);
    setSyncError(data.syncError);
    setLastUpdated(Date.now());
    setWindowOpen(true);
  };

  const handleRefresh = () => {
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      setLastUpdated(Date.now());
      if (scenario === "error") {
        setSyncError(false);
      }
    }, 350);
  };

  const updateDevicePct = (targetKey: string, pct: number) => {
    setDevices((prev) =>
      prev.map((d) =>
        deviceKey(d) === targetKey
          ? {
              ...d,
              batteryPct: pct,
              chargingState:
                pct === 100 && d.chargingState === "charging"
                  ? "full"
                  : d.chargingState === "full" && pct < 100
                    ? "discharging"
                    : d.chargingState,
            }
          : d,
      ),
    );
    setLastUpdated(Date.now());
  };

  const toggleDeviceCharging = (targetKey: string) => {
    setDevices((prev) =>
      prev.map((d) =>
        deviceKey(d) === targetKey
          ? {
              ...d,
              chargingState:
                d.chargingState === "charging" ? "discharging" : "charging",
            }
          : d,
      ),
    );
    setLastUpdated(Date.now());
  };

  const handleToggleSample = () => {
    if (!sampleMode) {
      setSampleMode(true);
      setDevices(INITIAL_DEVICES.map((d) => ({ ...d })));
      setChargerConnected(true);
      setSyncError(false);
    } else {
      applyScenario(scenario);
    }
  };

  const lowestPct = devices
    .filter((d) => hasBatteryReading(d))
    .reduce<number | null>(
      (min, d) => (min === null ? d.batteryPct : Math.min(min, d.batteryPct)),
      null,
    );

  return (
    <div className="mx-auto w-full max-w-[1140px] px-5 py-7 lg:py-9">
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_424px]">
        {/* Left: Hardware Simulator + Fixes */}
        <div className="space-y-5">
          <div className="rounded-xl border border-white/[0.08] bg-[#111720] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[#22C55E]" strokeWidth={2} />
                  <h2 className="text-[16px] font-semibold tracking-[-0.015em] text-[#F1F5F9]">
                    {copy.simTitle}
                  </h2>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-[#94A3B8]">
                  {copy.simSub}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setChargerConnected((c) => !c)}
                aria-pressed={chargerConnected}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  chargerConnected
                    ? "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]"
                    : "border-white/10 bg-[#0B0F14] text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                <PlugZap className="h-3.5 w-3.5" />
                <span>{copy.acPower}</span>
              </button>
            </div>

            {/* Scenario Selector */}
            <div className="mt-4">
              <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-[#64748B]">
                {copy.scenariosLabel}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["connected", "low", "empty", "error"] as ScenarioId[]).map(
                  (id) => {
                    const active = scenario === id && !sampleMode;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => applyScenario(id)}
                        aria-pressed={active}
                        className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
                          active
                            ? "border-[#22C55E]/50 bg-[#17202C] text-[#F1F5F9]"
                            : "border-white/[0.07] bg-[#0B0F14] text-[#94A3B8] hover:border-white/15 hover:text-[#F1F5F9]"
                        }`}
                      >
                        {copy.scenarios[id]}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {/* Per-Device Live Sliders */}
            {devices.some((d) => hasBatteryReading(d)) && (
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <div className="mb-3 flex items-center justify-between text-[11.5px] text-[#64748B]">
                  <span>{copy.controlsHint}</span>
                  <span className="font-mono text-[11px] text-[#94A3B8] tabular-nums">
                    ≤ {settings.lowBatteryThresholdPct}%
                  </span>
                </div>

                <div className="space-y-2.5">
                  {devices
                    .filter((d) => hasBatteryReading(d))
                    .map((dev) => {
                      const key = deviceKey(dev);
                      const label =
                        settings.locale === "mn" ? dev.labelMn : dev.labelEn;
                      const isCharging = dev.chargingState === "charging";
                      return (
                        <div
                          key={key}
                          className="rounded-lg border border-white/[0.06] bg-[#0B0F14] px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-[12.5px] font-medium text-[#E2E8F0]">
                              {label}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleDeviceCharging(key)}
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                  isCharging
                                    ? "bg-[#22C55E]/15 text-[#22C55E]"
                                    : "bg-white/[0.05] text-[#94A3B8] hover:text-[#F1F5F9]"
                                }`}
                              >
                                <Zap className="h-3 w-3" />
                                <span>
                                  {isCharging
                                    ? copy.chargingBtn
                                    : copy.dischargingBtn}
                                </span>
                              </button>
                              <span className="w-10 text-right font-mono text-[12px] font-semibold text-[#F1F5F9] tabular-nums">
                                {Math.round(dev.batteryPct)}%
                              </span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(dev.batteryPct)}
                            aria-label={label}
                            onChange={(e) =>
                              updateDevicePct(key, Number(e.target.value))
                            }
                            className="mt-2 h-1.5 w-full cursor-pointer accent-[#22C55E]"
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Concise Engineering Highlights */}
          <div className="rounded-xl border border-white/[0.08] bg-[#111720] p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#22C55E]" strokeWidth={2} />
              <h3 className="text-[14px] font-semibold text-[#F1F5F9]">
                {copy.fixesTitle}
              </h3>
            </div>
            <ul className="mt-3.5 space-y-2.5">
              {copy.fixes.map((item) => (
                <li
                  key={item.tag}
                  className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-[#94A3B8]"
                >
                  <CheckCircle2
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22C55E]"
                    aria-hidden="true"
                  />
                  <div>
                    <span className="mr-2 font-mono text-[10.5px] font-semibold text-[#CBD5E1]">
                      {item.tag}
                    </span>
                    <span>{item.text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Authentic 1:1 Desktop Tray Stage (400 x 480) */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[424px] rounded-2xl border border-white/[0.08] bg-[#070A0E] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.6)]">
            {/* Simulated Desktop Canvas Area */}
            <div className="relative flex h-[504px] flex-col items-center justify-end rounded-xl border border-white/[0.05] bg-[radial-gradient(ellipse_at_top,_#121A26_0%,_#090D13_72%)] p-3">
              {/* Native OS Notification Toast (positioned top-right of viewport so it never covers the 400x480 widget) */}
              {toast && (
                <div
                  role="status"
                  aria-live="polite"
                  className="fixed bottom-4 right-4 z-40 flex w-[min(340px,calc(100vw-2rem))] items-start gap-2.5 rounded-xl border border-[#EF4444]/40 bg-[#111720]/95 p-3.5 shadow-[0_18px_40px_rgba(0,0,0,0.65)] backdrop-blur"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EF4444]/15 text-[#EF4444]">
                    <Bell className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#EF4444]">
                      {copy.toastLabel}
                    </div>
                    <div className="mt-0.5 text-[12.5px] font-semibold text-[#F1F5F9]">
                      {toast.title}
                    </div>
                    <div className="text-[11.5px] text-[#94A3B8]">{toast.body}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToast(null)}
                    aria-label="Dismiss alert"
                    className="rounded p-1 text-[#64748B] hover:bg-white/[0.06] hover:text-[#F1F5F9]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Exact 400 x 480 Native Tray Popup Window */}
              {windowOpen ? (
                <div
                  className={`h-[480px] w-full max-w-[400px] overflow-hidden rounded-xl border shadow-[0_20px_50px_rgba(0,0,0,0.65)] transition-colors ${
                    pinned ? "border-[#22C55E]/40" : "border-white/[0.12]"
                  }`}
                >
                  <TrayWidget
                    devices={devices}
                    settings={settings}
                    chargerConnected={chargerConnected}
                    lastUpdated={lastUpdated}
                    loading={false}
                    syncing={syncing}
                    syncError={syncError}
                    sampleMode={sampleMode}
                    pinned={pinned}
                    isDesktop={true}
                    onRefresh={handleRefresh}
                    onUpdateSettings={onUpdateSettings}
                    onToggleAutostart={() =>
                      onUpdateSettings({
                        launchAtLogin: !settings.launchAtLogin,
                      })
                    }
                    onTogglePin={() => setPinned((p) => !p)}
                    onHideWindow={() => setWindowOpen(false)}
                    onToggleSample={handleToggleSample}
                  />
                </div>
              ) : (
                <div className="mb-auto mt-auto flex flex-col items-center px-6 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#111720] text-[#22C55E]">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <p className="mt-3 max-w-[260px] text-[13px] text-[#94A3B8]">
                    {copy.trayHiddenTitle}
                  </p>
                  <button
                    type="button"
                    onClick={() => setWindowOpen(true)}
                    className="mt-4 rounded-lg bg-[#22C55E] px-4 py-2 text-[12.5px] font-semibold text-[#04140A] transition-colors hover:bg-[#16A34A]"
                  >
                    {copy.trayHiddenAction}
                  </button>
                </div>
              )}
            </div>

            {/* Simulated Desktop System Tray Bar */}
            <div className="mt-2.5 flex h-10 items-center justify-between rounded-lg border border-white/[0.06] bg-[#0D1219] px-3 text-[11px] text-[#64748B]">
              <span className="font-mono text-[10.5px] text-[#64748B]">
                400 × 480 · Tauri v2
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setWindowOpen((v) => !v)}
                  title={copy.trayTooltip}
                  aria-label={copy.trayTooltip}
                  aria-expanded={windowOpen}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${
                    windowOpen
                      ? "border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]"
                      : "border-white/[0.08] bg-[#111720] text-[#CBD5E1] hover:border-white/20"
                  }`}
                >
                  <Zap className="h-3 w-3" />
                  <span className="tabular-nums">
                    {lowestPct !== null ? `${Math.round(lowestPct)}%` : "—"}
                  </span>
                </button>
                <span className="font-mono text-[11px] tabular-nums text-[#94A3B8]">
                  14:20
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
