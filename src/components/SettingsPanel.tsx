import { ShieldCheck } from "lucide-react";
import { DICTIONARIES } from "../lib/i18n";
import type { AppSettings, Locale, LowBatteryThreshold } from "../lib/types";

interface SettingsPanelProps {
  settings: AppSettings;
  pinned: boolean;
  canPin: boolean;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onToggleAutostart: () => void;
  onTogglePin: () => void;
}

const THRESHOLDS: LowBatteryThreshold[] = [10, 15, 20];

function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] ${
        checked
          ? "border-[#22C55E]/60 bg-[#22C55E]/25"
          : "border-white/15 bg-[#0B0F14]"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
          checked ? "translate-x-[18px] bg-[#22C55E]" : "translate-x-[2px] bg-[#64748B]"
        }`}
      />
    </button>
  );
}

export function SettingsPanel({
  settings,
  pinned,
  canPin,
  onUpdateSettings,
  onToggleAutostart,
  onTogglePin,
}: SettingsPanelProps) {
  const dict = DICTIONARIES[settings.locale].settings;

  const setLocale = (locale: Locale) => onUpdateSettings({ locale });

  return (
    <div className="space-y-2.5">
      {/* Language */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-[#111720] px-3 py-2.5">
        <span className="text-[12.5px] font-medium text-[#F1F5F9]">
          {dict.language}
        </span>
        <div
          role="group"
          aria-label={dict.language}
          className="inline-flex rounded-md border border-white/[0.08] bg-[#0B0F14] p-0.5"
        >
          {(["en", "mn"] as const).map((code) => {
            const active = settings.locale === code;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                onClick={() => setLocale(code)}
                className={`rounded px-2.5 py-1 font-mono text-[11px] font-semibold uppercase transition-colors ${
                  active
                    ? "bg-[#1C2736] text-[#F1F5F9]"
                    : "text-[#64748B] hover:text-[#CBD5E1]"
                }`}
              >
                {code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Low-battery Alerts */}
      <div className="rounded-lg border border-white/[0.07] bg-[#111720] px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-[#F1F5F9]">
              {dict.alertsTitle}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-[#64748B]">
              {dict.alertsDesc}
            </p>
          </div>
          <Switch
            checked={settings.notificationsEnabled}
            label={dict.alertsTitle}
            onChange={() =>
              onUpdateSettings({
                notificationsEnabled: !settings.notificationsEnabled,
              })
            }
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
          <span className="text-[11px] text-[#94A3B8]">{dict.thresholdLabel}</span>
          <div
            role="group"
            aria-label={dict.thresholdLabel}
            className="inline-flex rounded-md border border-white/[0.08] bg-[#0B0F14] p-0.5"
          >
            {THRESHOLDS.map((value) => {
              const active = settings.lowBatteryThresholdPct === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={!settings.notificationsEnabled}
                  aria-pressed={active}
                  onClick={() =>
                    onUpdateSettings({ lowBatteryThresholdPct: value })
                  }
                  className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums transition-colors disabled:opacity-40 ${
                    active
                      ? "bg-[#1C2736] text-[#22C55E]"
                      : "text-[#64748B] hover:text-[#CBD5E1]"
                  }`}
                >
                  {value}%
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Launch at login */}
      <div className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.07] bg-[#111720] px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-[#F1F5F9]">
            {dict.autostartTitle}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-[#64748B]">
            {dict.autostartDesc}
          </p>
        </div>
        <Switch
          checked={settings.launchAtLogin}
          label={dict.autostartTitle}
          onChange={onToggleAutostart}
        />
      </div>

      {/* Keep on top */}
      {canPin && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.07] bg-[#111720] px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-[#F1F5F9]">
              {dict.pinTitle}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-[#64748B]">
              {dict.pinDesc}
            </p>
          </div>
          <Switch
            checked={pinned}
            label={dict.pinTitle}
            onChange={onTogglePin}
          />
        </div>
      )}

      {/* Read-only privacy guarantee */}
      <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-[#0B0F14] px-3 py-2.5 text-[11px] leading-relaxed text-[#64748B]">
        <ShieldCheck
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22C55E]"
          strokeWidth={1.9}
          aria-hidden="true"
        />
        <span>{dict.readOnlyNote}</span>
      </div>
    </div>
  );
}
