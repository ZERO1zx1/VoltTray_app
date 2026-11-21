import { useCallback, useEffect, useState } from "react";
import DesktopApp from "./DesktopApp";
import { DesktopWorkbench } from "./components/DesktopWorkbench";
import { LandingPreview } from "./components/LandingPreview";
import { INITIAL_SETTINGS } from "./lib/defaults";
import { isTauriDesktopRuntime } from "./lib/desktopBridge";
import type { AppSettings, Locale } from "./lib/types";

type ActiveTab = "desktop" | "landing";

const NAV_COPY: Record<
  Locale,
  { desktop: string; landing: string; langAria: string }
> = {
  en: {
    desktop: "Desktop App",
    landing: "Landing Page",
    langAria: "Switch language",
  },
  mn: {
    desktop: "Десктоп апп",
    landing: "Танилцуулга",
    langAria: "Хэл солих",
  },
};

export default function App() {
  if (isTauriDesktopRuntime()) {
    return <DesktopApp />;
  }

  return <BrowserShowcase />;
}

function BrowserShowcase() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("desktop");
  const [settings, setSettings] = useState<AppSettings>({
    ...INITIAL_SETTINGS,
    locale: "mn",
  });

  useEffect(() => {
    document.documentElement.lang = settings.locale;
  }, [settings.locale]);

  const handleUpdateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const nav = NAV_COPY[settings.locale];

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#F1F5F9]">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 h-14 border-b border-white/[0.07] bg-[#0D1219]/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1140px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5">
          {/* Zone 1: Brand */}
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[#22C55E]/15 text-[#22C55E]"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11.2 2.5L4.5 11h5l-.7 6.5L15.5 9h-5l.7-6.5z" />
              </svg>
            </span>
            <span className="text-[14px] font-bold tracking-[-0.02em] text-[#F1F5F9] sm:text-[15px]">
              VoltTray
            </span>
          </div>

          {/* Zone 2: Navigation */}
          <nav
            aria-label="Workspace view"
            className="inline-flex shrink-0 rounded-lg border border-white/[0.08] bg-[#0B0F14] p-0.5"
          >
            <button
              type="button"
              onClick={() => setActiveTab("desktop")}
              aria-pressed={activeTab === "desktop"}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors sm:px-3.5 sm:text-[12.5px] ${
                activeTab === "desktop"
                  ? "bg-[#17202C] text-[#F1F5F9]"
                  : "text-[#94A3B8] hover:text-[#F1F5F9]"
              }`}
            >
              {nav.desktop}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("landing")}
              aria-pressed={activeTab === "landing"}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors sm:px-3.5 sm:text-[12.5px] ${
                activeTab === "landing"
                  ? "bg-[#17202C] text-[#F1F5F9]"
                  : "text-[#94A3B8] hover:text-[#F1F5F9]"
              }`}
            >
              {nav.landing}
            </button>
          </nav>

          {/* Zone 3: Language */}
          <div
            role="group"
            aria-label={nav.langAria}
            className="inline-flex shrink-0 rounded-md border border-white/[0.08] bg-[#0B0F14] p-0.5"
          >
            {(["mn", "en"] as const).map((code) => {
              const active = settings.locale === code;
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleUpdateSettings({ locale: code })}
                  className={`rounded px-2 py-1 font-mono text-[10.5px] font-semibold uppercase transition-colors sm:px-2.5 sm:text-[11px] ${
                    active
                      ? "bg-[#17202C] text-[#F1F5F9]"
                      : "text-[#64748B] hover:text-[#CBD5E1]"
                  }`}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {activeTab === "desktop" ? (
        <DesktopWorkbench
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      ) : (
        <LandingPreview
          locale={settings.locale}
          onOpenDesktopDemo={() => setActiveTab("desktop")}
        />
      )}
    </div>
  );
}
