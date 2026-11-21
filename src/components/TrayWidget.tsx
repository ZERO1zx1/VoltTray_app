import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BatteryCharging,
  Pin,
  PinOff,
  PlugZap,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import {
  deviceKey,
  formatLastUpdated,
  hasBatteryReading,
} from "../lib/battery";
import { DICTIONARIES } from "../lib/i18n";
import type { AppSettings, PeripheralDevice } from "../lib/types";
import { DeviceRow } from "./DeviceRow";
import { SettingsPanel } from "./SettingsPanel";

export interface TrayWidgetProps {
  devices: PeripheralDevice[];
  settings: AppSettings;
  chargerConnected: boolean;
  lastUpdated: number | null;
  nowMs?: number;
  loading: boolean;
  syncing: boolean;
  syncError: boolean;
  errorBanner?: string | null;
  onDismissError?: () => void;
  sampleMode: boolean;
  pinned: boolean;
  isDesktop: boolean;
  onRefresh: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onToggleAutostart: () => void;
  onTogglePin: () => void;
  onHideWindow: () => void;
  onToggleSample: () => void;
}

export function TrayWidget({
  devices,
  settings,
  chargerConnected,
  lastUpdated,
  nowMs,
  loading,
  syncing,
  syncError,
  errorBanner,
  onDismissError,
  sampleMode,
  pinned,
  isDesktop,
  onRefresh,
  onUpdateSettings,
  onToggleAutostart,
  onTogglePin,
  onHideWindow,
  onToggleSample,
}: TrayWidgetProps) {
  const [view, setView] = useState<"devices" | "settings">("devices");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const dict = DICTIONARIES[settings.locale];

  const handleToggleRow = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const anyCharging =
    chargerConnected ||
    devices.some((d) => hasBatteryReading(d) && d.chargingState === "charging");

  return (
    <section
      aria-label={dict.header.ariaLabel}
      className="flex h-full w-full flex-col overflow-hidden bg-[#0B0F14] text-[#F1F5F9] select-none"
    >
      {/* Window Titlebar */}
      <header
        data-tauri-drag-region
        className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0D1219] px-3.5"
      >
        <div className="flex items-center gap-2" data-tauri-drag-region>
          {view === "settings" ? (
            <button
              type="button"
              onClick={() => setView("devices")}
              aria-label={dict.header.backToDevices}
              className="-ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-[#94A3B8] transition-colors hover:bg-white/[0.06] hover:text-[#F1F5F9]"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.9} />
            </button>
          ) : (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md bg-[#22C55E]/15 text-[#22C55E]"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="h-3.5 w-3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11.2 2.5L4.5 11h5l-.7 6.5L15.5 9h-5l.7-6.5z" />
              </svg>
            </span>
          )}

          <h1 className="text-[13.5px] font-semibold tracking-[-0.015em] text-[#F1F5F9]">
            {view === "settings" ? dict.settings.title : dict.appName}
          </h1>

          {sampleMode && view === "devices" && (
            <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[#F59E0B]">
              · {dict.header.sampleTag}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {view === "devices" && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={syncing}
              title={dict.header.refresh}
              aria-label={dict.header.refresh}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#94A3B8] transition-colors hover:bg-white/[0.06] hover:text-[#F1F5F9] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-[#22C55E]" : ""}`}
                strokeWidth={1.9}
              />
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              setView((prev) => (prev === "devices" ? "settings" : "devices"))
            }
            title={
              view === "devices"
                ? dict.header.settings
                : dict.header.backToDevices
            }
            aria-label={
              view === "devices"
                ? dict.header.settings
                : dict.header.backToDevices
            }
            aria-pressed={view === "settings"}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              view === "settings"
                ? "bg-white/[0.08] text-[#F1F5F9]"
                : "text-[#94A3B8] hover:bg-white/[0.06] hover:text-[#F1F5F9]"
            }`}
          >
            <Settings className="h-3.5 w-3.5" strokeWidth={1.9} />
          </button>

          {isDesktop && (
            <>
              <button
                type="button"
                onClick={onTogglePin}
                title={pinned ? dict.header.unpin : dict.header.pin}
                aria-label={pinned ? dict.header.unpin : dict.header.pin}
                aria-pressed={pinned}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  pinned
                    ? "bg-[#22C55E]/15 text-[#22C55E]"
                    : "text-[#94A3B8] hover:bg-white/[0.06] hover:text-[#F1F5F9]"
                }`}
              >
                {pinned ? (
                  <PinOff className="h-3.5 w-3.5" strokeWidth={1.9} />
                ) : (
                  <Pin className="h-3.5 w-3.5" strokeWidth={1.9} />
                )}
              </button>

              <button
                type="button"
                onClick={onHideWindow}
                title={dict.header.close}
                aria-label={dict.header.close}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#94A3B8] transition-colors hover:bg-white/[0.06] hover:text-[#F1F5F9]"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.9} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Summary Bar (Devices View Only) */}
      {view === "devices" && (
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/[0.05] bg-[#0B0F14] px-3.5 text-[11px] text-[#94A3B8]">
          <div className="flex items-center gap-1.5">
            {anyCharging ? (
              <PlugZap
                className="h-3.5 w-3.5 text-[#22C55E]"
                strokeWidth={2}
                aria-hidden="true"
              />
            ) : (
              <BatteryCharging
                className="h-3.5 w-3.5 text-[#64748B]"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            )}
            <span className={anyCharging ? "text-[#CBD5E1]" : "text-[#94A3B8]"}>
              {anyCharging
                ? dict.summary.chargerConnected
                : dict.summary.chargerUnplugged}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-[#94A3B8]">
            <span>{dict.summary.deviceCount(devices.length)}</span>
            {sampleMode && (
              <button
                type="button"
                onClick={onToggleSample}
                className="font-sans text-[11px] font-medium text-[#22C55E] hover:underline"
              >
                {dict.states.exitSample}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Scrollable Area */}
      <main className="volt-scroll flex-1 overflow-y-auto px-3 py-2.5">
        {errorBanner && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-[#EF4444]/35 bg-[#EF4444]/12 px-3 py-2 text-[11.5px] leading-snug text-[#FCA5A5]"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#EF4444]"
                aria-hidden="true"
              />
              <span>{errorBanner}</span>
            </div>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                aria-label={dict.errors.dismiss}
                className="-mr-1 -mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#FCA5A5]/80 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
          </div>
        )}

        {view === "settings" ? (
          <SettingsPanel
            settings={settings}
            pinned={pinned}
            canPin={isDesktop}
            onUpdateSettings={onUpdateSettings}
            onToggleAutostart={onToggleAutostart}
            onTogglePin={onTogglePin}
          />
        ) : (
          <div className="space-y-2">
            {syncError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-[11.5px] leading-snug text-[#FDE68A]"
              >
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F59E0B]"
                  aria-hidden="true"
                />
                <span>{dict.states.syncFailed}</span>
              </div>
            )}

            {loading ? (
              <div className="space-y-2 py-2" aria-busy="true">
                {[0, 1, 2].map((idx) => (
                  <div
                    key={idx}
                    className="h-[62px] rounded-lg border border-white/[0.05] bg-[#111720] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-md bg-white/[0.05]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-32 rounded bg-white/[0.06]" />
                        <div className="h-2.5 w-20 rounded bg-white/[0.04]" />
                      </div>
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-center text-[11px] text-[#94A3B8]">
                  {dict.states.scanning}
                </p>
              </div>
            ) : devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.09] bg-[#111720]/60 px-5 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-[#0B0F14] text-[#94A3B8]">
                  <BatteryCharging className="h-5 w-5" strokeWidth={1.6} />
                </div>
                <h2 className="mt-3 text-[13px] font-semibold text-[#F1F5F9]">
                  {dict.states.emptyTitle}
                </h2>
                <p className="mt-1 max-w-[260px] text-[11.5px] leading-relaxed text-[#94A3B8]">
                  {dict.states.emptyBody}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="rounded-md bg-[#22C55E] px-3 py-1.5 text-[11.5px] font-semibold text-[#04140A] transition-colors hover:bg-[#16A34A]"
                  >
                    {dict.states.scanDevices}
                  </button>
                  <button
                    type="button"
                    onClick={onToggleSample}
                    className="rounded-md border border-white/[0.1] bg-[#17202C] px-3 py-1.5 text-[11.5px] font-medium text-[#CBD5E1] transition-colors hover:border-white/20 hover:text-[#F1F5F9]"
                  >
                    {dict.states.samplePreview}
                  </button>
                </div>
              </div>
            ) : (
              devices.map((device) => {
                const key = deviceKey(device);
                return (
                  <DeviceRow
                    key={key}
                    device={device}
                    locale={settings.locale}
                    thresholdPct={settings.lowBatteryThresholdPct}
                    expanded={expandedKey === key}
                    onToggle={handleToggleRow}
                  />
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Footer Strip */}
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-white/[0.07] bg-[#0D1219] px-3.5 text-[10.5px] text-[#94A3B8]">
        <span className="font-mono tabular-nums">
          {formatLastUpdated(lastUpdated, settings.locale, nowMs)}
        </span>
        <button
          type="button"
          onClick={onToggleAutostart}
          className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-[#94A3B8] transition-colors hover:text-[#F1F5F9]"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              settings.launchAtLogin ? "bg-[#22C55E]" : "bg-[#475569]"
            }`}
            aria-hidden="true"
          />
          <span>{dict.footer.autostartShort}</span>
        </button>
      </footer>
    </section>
  );
}
