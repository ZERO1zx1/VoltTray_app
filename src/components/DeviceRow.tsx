import {
  Battery,
  BatteryCharging,
  ChevronDown,
  Gamepad2,
  Headphones,
  Keyboard,
  Laptop,
  Mouse,
  Usb,
  Zap,
} from "lucide-react";
import {
  connectionBadge,
  deviceKey,
  deviceSubtitle,
  hasBatteryReading,
  isDeviceLow,
} from "../lib/battery";
import { DICTIONARIES } from "../lib/i18n";
import type { DeviceType, Locale, PeripheralDevice } from "../lib/types";

interface DeviceRowProps {
  device: PeripheralDevice;
  locale: Locale;
  thresholdPct: number;
  expanded: boolean;
  onToggle: (key: string) => void;
}

function DeviceIcon({ type, low }: { type: DeviceType; low: boolean }) {
  const cls = `h-4 w-4 shrink-0 ${low ? "text-[#EF4444]" : "text-[#94A3B8]"}`;
  switch (type) {
    case "laptop":
      return <Laptop className={cls} strokeWidth={1.75} />;
    case "mouse":
      return <Mouse className={cls} strokeWidth={1.75} />;
    case "keyboard":
      return <Keyboard className={cls} strokeWidth={1.75} />;
    case "headset":
      return <Headphones className={cls} strokeWidth={1.75} />;
    case "controller":
      return <Gamepad2 className={cls} strokeWidth={1.75} />;
    case "other":
      return <Usb className={cls} strokeWidth={1.75} />;
    default:
      return <Battery className={cls} strokeWidth={1.75} />;
  }
}

function levelTone(
  device: PeripheralDevice,
  hasReading: boolean,
  low: boolean,
): { bar: string; text: string } {
  if (!hasReading) {
    return { bar: "bg-white/15", text: "text-[#64748B]" };
  }
  if (device.chargingState === "charging" || device.chargingState === "full") {
    return { bar: "bg-[#22C55E]", text: "text-[#22C55E]" };
  }
  if (low) {
    return { bar: "bg-[#EF4444]", text: "text-[#EF4444]" };
  }
  if (device.batteryPct <= 50) {
    return { bar: "bg-[#F59E0B]", text: "text-[#F1F5F9]" };
  }
  return { bar: "bg-[#22C55E]", text: "text-[#F1F5F9]" };
}

export function DeviceRow({
  device,
  locale,
  thresholdPct,
  expanded,
  onToggle,
}: DeviceRowProps) {
  const dict = DICTIONARIES[locale].device;
  const key = deviceKey(device);
  const name = locale === "mn" ? device.labelMn : device.labelEn;
  const readable = hasBatteryReading(device);
  const low = isDeviceLow(device, thresholdPct);
  const tone = levelTone(device, readable, low);
  const pct = readable ? Math.max(0, Math.min(100, Math.round(device.batteryPct))) : 0;
  const connText = connectionBadge(device, locale);
  const statusText = deviceSubtitle(device, locale);
  const isCharging = device.chargingState === "charging";
  const panelId = `device-details-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <div
      className={`rounded-lg border transition-colors ${
        low
          ? "border-[#EF4444]/35 bg-[#111720]"
          : expanded
            ? "border-white/15 bg-[#151D28]"
            : "border-white/[0.07] bg-[#111720] hover:border-white/[0.13]"
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => onToggle(key)}
        className="w-full px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]/70 rounded-lg"
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
              low
                ? "border-[#EF4444]/30 bg-[#EF4444]/10"
                : "border-white/[0.07] bg-[#0B0F14]"
            }`}
          >
            <DeviceIcon type={device.type} low={low} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[#F1F5F9]">
                {name}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                {isCharging && (
                  <Zap
                    className="h-3.5 w-3.5 text-[#22C55E]"
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`font-mono text-[13px] font-semibold tabular-nums ${tone.text}`}
                >
                  {readable ? `${pct}%` : "—"}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-[#64748B] transition-transform duration-150 ${
                    expanded ? "rotate-180 text-[#94A3B8]" : ""
                  }`}
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-[#94A3B8]">
              <span className="truncate">
                {connText}
                <span className="mx-1.5 text-[#475569]" aria-hidden="true">
                  ·
                </span>
                <span className={low ? "font-medium text-[#EF4444]" : ""}>
                  {low ? dict.lowWarning : statusText}
                </span>
              </span>
            </div>

            {readable && (
              <div
                className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.08]"
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${tone.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div
          id={panelId}
          className="border-t border-white/[0.06] px-3 py-2.5 text-[11px] text-[#94A3B8]"
        >
          {device.batteryComponents && device.batteryComponents.length > 0 && (
            <div
              aria-label={dict.componentsAria}
              className="mb-2.5 grid grid-cols-3 gap-1.5"
            >
              {device.batteryComponents.map((comp) => {
                const compPct = Math.max(0, Math.min(100, Math.round(comp.batteryPct)));
                const compLow = !comp.charging && compPct <= thresholdPct;
                return (
                  <div
                    key={comp.id}
                    className="rounded-md border border-white/[0.06] bg-[#0B0F14] px-2 py-1.5"
                  >
                    <div className="flex items-center justify-between gap-1 text-[10px] text-[#94A3B8]">
                      <span>{dict.components[comp.id]}</span>
                      {comp.charging && (
                        <BatteryCharging
                          className="h-3 w-3 text-[#22C55E]"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div
                      className={`mt-0.5 font-mono text-[12px] font-semibold tabular-nums ${
                        compLow
                          ? "text-[#EF4444]"
                          : comp.charging
                            ? "text-[#22C55E]"
                            : "text-[#F1F5F9]"
                      }`}
                    >
                      {compPct}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <dl className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#64748B]">{dict.connectionLabel}</dt>
              <dd className="font-mono text-[11px] text-[#CBD5E1]">{connText}</dd>
            </div>
            {device.batterySource && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#64748B]">{dict.sourceLabel}</dt>
                <dd className="font-mono text-[11px] text-[#CBD5E1]">
                  {device.batterySource}
                </dd>
              </div>
            )}
            {device.supportsHealth && typeof device.healthPct === "number" && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#64748B]">{dict.healthLabel}</dt>
                <dd className="font-mono text-[11px] font-medium text-[#22C55E] tabular-nums">
                  {device.healthPct}%
                </dd>
              </div>
            )}
          </dl>

          {device.type === "laptop" && (
            <p className="mt-2 border-t border-white/[0.05] pt-2 text-[10.5px] leading-relaxed text-[#64748B]">
              {dict.healthNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
