import { useCallback, useEffect, useRef, useState } from "react";
import { TrayWidget } from "./components/TrayWidget";
import { evaluateLowBattery, settingsEqual } from "./lib/battery";
import {
  hideWidgetWindow,
  isTauriDesktopRuntime,
  loadLocalBootstrap,
  persistLocalSettings,
  sendLowBatteryNotification,
  setWidgetPinned,
  subscribeLocalStream,
  toggleOsAutostart,
  type LocalBootstrapPayload,
} from "./lib/desktopBridge";
import { INITIAL_DEVICES, INITIAL_SETTINGS } from "./lib/defaults";
import { DICTIONARIES } from "./lib/i18n";
import type { AppSettings, PeripheralDevice } from "./lib/types";

function mergeSettings(
  payload: LocalBootstrapPayload | null,
  fallback: AppSettings,
): AppSettings {
  const saved = payload?.settings;
  const threshold = saved?.lowBatteryThresholdPct;
  return {
    locale:
      saved?.locale === "mn"
        ? "mn"
        : saved?.locale === "en"
          ? "en"
          : fallback.locale,
    notificationsEnabled:
      typeof saved?.notificationsEnabled === "boolean"
        ? saved.notificationsEnabled
        : fallback.notificationsEnabled,
    lowBatteryThresholdPct:
      threshold === 10 || threshold === 15 || threshold === 20
        ? threshold
        : fallback.lowBatteryThresholdPct,
    launchAtLogin:
      typeof payload?.autostartEnabled === "boolean"
        ? payload.autostartEnabled
        : typeof saved?.launchAtLogin === "boolean"
          ? saved.launchAtLogin
          : fallback.launchAtLogin,
  };
}

const ERROR_BANNER_MS = 3_800;

export default function App() {
  const [devices, setDevices] = useState<PeripheralDevice[]>([]);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [chargerConnected, setChargerConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const isDesktop = isTauriDesktopRuntime();
  const alertedRef = useRef<Set<string>>(new Set());
  const lastSavedSettingsRef = useRef<AppSettings | null>(null);
  const settingsRef = useRef<AppSettings>(settings);
  const pinnedRef = useRef<boolean>(pinned);
  const sampleModeRef = useRef<boolean>(sampleMode);
  const bannerTimerRef = useRef<number | null>(null);

  settingsRef.current = settings;
  pinnedRef.current = pinned;
  sampleModeRef.current = sampleMode;

  const dismissErrorBanner = useCallback(() => {
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setErrorBanner(null);
  }, []);

  const showErrorBanner = useCallback((message: string) => {
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    setErrorBanner(message);
    bannerTimerRef.current = window.setTimeout(() => {
      bannerTimerRef.current = null;
      setErrorBanner(null);
    }, ERROR_BANNER_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const applyPayload = useCallback((payload: LocalBootstrapPayload | null) => {
    if (!payload) {
      setSyncError(true);
      setLoading(false);
      return false;
    }
    setDevices(Array.isArray(payload.devices) ? payload.devices : []);
    setChargerConnected(Boolean(payload.chargerConnected));
    setLastUpdated(Date.now());
    setSyncError(false);
    setLoading(false);
    return true;
  }, []);

  const handleRefresh = useCallback(async () => {
    if (sampleModeRef.current) {
      setLastUpdated(Date.now());
      return;
    }
    setSyncing(true);
    try {
      const payload = await loadLocalBootstrap(true);
      const ok = applyPayload(payload);
      if (!ok) {
        showErrorBanner(DICTIONARIES[settingsRef.current.locale].errors.refreshFailed);
      }
    } catch {
      setSyncError(true);
      setLoading(false);
      showErrorBanner(DICTIONARIES[settingsRef.current.locale].errors.refreshFailed);
    } finally {
      setSyncing(false);
    }
  }, [applyPayload, showErrorBanner]);

  // Initial hydration
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const payload = await loadLocalBootstrap(false);
        if (!active) return;
        const resolved = mergeSettings(payload, INITIAL_SETTINGS);
        lastSavedSettingsRef.current = resolved;
        setSettings(resolved);
        applyPayload(payload);
      } catch {
        if (!active) return;
        setSyncError(true);
        setLoading(false);
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyPayload]);

  // Live updates: Tauri reads cached Rust snapshot while visible; web uses SSE with fallback poll only on error
  useEffect(() => {
    if (sampleMode) return;

    if (isDesktop) {
      const timer = window.setInterval(() => {
        if (document.hidden) return;
        void loadLocalBootstrap(false).then((payload) => {
          if (payload) applyPayload(payload);
        });
      }, 2_500);
      return () => window.clearInterval(timer);
    }

    let fallbackTimer: number | null = null;
    const startFallback = () => {
      if (fallbackTimer !== null) return;
      fallbackTimer = window.setInterval(() => {
        void loadLocalBootstrap(false).then(applyPayload);
      }, 4_000);
    };

    const unsubscribe = subscribeLocalStream(
      (payload) => {
        if (fallbackTimer !== null) {
          window.clearInterval(fallbackTimer);
          fallbackTimer = null;
        }
        applyPayload(payload);
      },
      startFallback,
    );

    return () => {
      unsubscribe();
      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer);
      }
    };
  }, [applyPayload, isDesktop, sampleMode]);

  // Keep relative timestamp fresh
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  // Sync HTML lang attribute
  useEffect(() => {
    document.documentElement.lang = settings.locale;
  }, [settings.locale]);

  // Persist settings ONLY when settings actually changed (prevents disk thrashing)
  useEffect(() => {
    if (!hydrated) return;
    if (
      lastSavedSettingsRef.current &&
      settingsEqual(lastSavedSettingsRef.current, settings)
    ) {
      return;
    }
    lastSavedSettingsRef.current = settings;
    void persistLocalSettings(settings);
  }, [hydrated, settings]);

  // Web-fallback low-battery alerts (Tauri handles this natively in background Rust daemon)
  useEffect(() => {
    if (isDesktop || sampleMode) return;
    const alerts = evaluateLowBattery(devices, settings, alertedRef.current);
    const body = DICTIONARIES[settings.locale].notifications.lowBatteryBody;
    for (const dev of alerts) {
      const label = settings.locale === "mn" ? dev.labelMn : dev.labelEn;
      void sendLowBatteryNotification(
        `${label} (${Math.round(dev.batteryPct)}%)`,
        body,
      );
    }
  }, [devices, isDesktop, sampleMode, settings]);

  const handleUpdateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleToggleAutostart = useCallback(async () => {
    const previous = settingsRef.current.launchAtLogin;
    const target = !previous;
    setSettings((curr) => ({ ...curr, launchAtLogin: target }));

    try {
      const result = await toggleOsAutostart(target);
      if (!result.ok) {
        setSettings((curr) => ({ ...curr, launchAtLogin: previous }));
        showErrorBanner(
          DICTIONARIES[settingsRef.current.locale].errors.autostartFailed,
        );
        return;
      }
      setSettings((curr) =>
        curr.launchAtLogin === result.enabled
          ? curr
          : { ...curr, launchAtLogin: result.enabled },
      );
    } catch {
      setSettings((curr) => ({ ...curr, launchAtLogin: previous }));
      showErrorBanner(
        DICTIONARIES[settingsRef.current.locale].errors.autostartFailed,
      );
    }
  }, [showErrorBanner]);

  const handleTogglePin = useCallback(async () => {
    const previous = pinnedRef.current;
    const target = !previous;
    setPinned(target);

    try {
      const result = await setWidgetPinned(target);
      if (!result.ok) {
        setPinned(previous);
        showErrorBanner(
          DICTIONARIES[settingsRef.current.locale].errors.pinFailed,
        );
        return;
      }
      setPinned(result.pinned);
    } catch {
      setPinned(previous);
      showErrorBanner(
        DICTIONARIES[settingsRef.current.locale].errors.pinFailed,
      );
    }
  }, [showErrorBanner]);

  const handleHideWindow = useCallback(() => {
    void hideWidgetWindow();
  }, []);

  const handleToggleSample = useCallback(async () => {
    const next = !sampleModeRef.current;
    setSampleMode(next);

    if (next) {
      setDevices(INITIAL_DEVICES);
      setChargerConnected(true);
      setSyncError(false);
      setLastUpdated(Date.now());
      return;
    }

    setLoading(true);
    try {
      const payload = await loadLocalBootstrap(true);
      const ok = applyPayload(payload);
      if (!ok) {
        showErrorBanner(
          DICTIONARIES[settingsRef.current.locale].errors.refreshFailed,
        );
      }
    } catch {
      setSyncError(true);
      setLoading(false);
      showErrorBanner(
        DICTIONARIES[settingsRef.current.locale].errors.refreshFailed,
      );
    }
  }, [applyPayload, showErrorBanner]);

  return (
    <div className="h-screen w-screen overflow-hidden rounded-xl border border-white/[0.08] bg-[#0B0F14]">
      <TrayWidget
        devices={devices}
        settings={settings}
        chargerConnected={chargerConnected}
        lastUpdated={lastUpdated}
        nowMs={nowMs}
        loading={loading}
        syncing={syncing}
        syncError={syncError}
        errorBanner={errorBanner}
        onDismissError={dismissErrorBanner}
        sampleMode={sampleMode}
        pinned={pinned}
        isDesktop={isDesktop}
        onRefresh={() => void handleRefresh()}
        onUpdateSettings={handleUpdateSettings}
        onToggleAutostart={() => void handleToggleAutostart()}
        onTogglePin={() => void handleTogglePin()}
        onHideWindow={handleHideWindow}
        onToggleSample={() => void handleToggleSample()}
      />
    </div>
  );
}
