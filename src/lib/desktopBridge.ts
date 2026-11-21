import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppSettings, PeripheralDevice } from "./types";

export interface LocalBootstrapPayload {
  mode?: string;
  os?: string;
  chargerConnected?: boolean;
  autostartEnabled?: boolean;
  probedHardwareCount?: number;
  settings?: Partial<AppSettings> | null;
  devices?: PeripheralDevice[];
}

export interface NotificationActionRequest {
  action: "send_low_battery_alert";
  title?: string;
  body?: string;
}

export interface AutostartToggleResult {
  ok: boolean;
  enabled: boolean;
  error?: string;
}

export interface PinToggleResult {
  ok: boolean;
  pinned: boolean;
  error?: string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isTauriDesktopRuntime(): boolean {
  return typeof window !== "undefined" && isTauri();
}

export async function loadLocalBootstrap(
  force = false,
): Promise<LocalBootstrapPayload | null> {
  if (isTauriDesktopRuntime()) {
    try {
      return await invoke<LocalBootstrapPayload>("get_local_bootstrap", {
        force,
      });
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch(
      force ? "/api/local/bootstrap?force=1" : "/api/local/bootstrap",
    );
    if (!res.ok) return null;
    return (await res.json()) as LocalBootstrapPayload;
  } catch {
    return null;
  }
}

export function subscribeLocalStream(
  onUpdate: (payload: LocalBootstrapPayload) => void,
  onError?: () => void,
): () => void {
  if (isTauriDesktopRuntime() || typeof EventSource === "undefined") {
    return () => {};
  }
  const source = new EventSource("/api/local/stream");
  source.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data) as LocalBootstrapPayload;
      onUpdate(parsed);
    } catch {
      // Ignore malformed SSE payload
    }
  };
  source.onerror = () => {
    onError?.();
  };
  return () => {
    source.close();
  };
}

/** Persist only user preferences — never overwrite disk with transient hardware device lists. */
export async function persistLocalSettings(
  settings: AppSettings,
): Promise<void> {
  if (isTauriDesktopRuntime()) {
    try {
      await invoke("save_local_state", {
        payload: { settings },
      });
    } catch {
      // Ignore desktop save error
    }
    return;
  }

  try {
    await fetch("/api/local/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
  } catch {
    // Ignore local web save error
  }
}

export async function toggleOsAutostart(
  enabled: boolean,
): Promise<AutostartToggleResult> {
  if (isTauriDesktopRuntime()) {
    try {
      const actual = await invoke<boolean>("set_autostart", { enabled });
      return { ok: true, enabled: actual };
    } catch (err) {
      return {
        ok: false,
        enabled: !enabled,
        error: errorMessage(err),
      };
    }
  }

  try {
    const res = await fetch("/api/local/autostart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      return {
        ok: false,
        enabled: !enabled,
        error: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { enabled?: boolean };
    return { ok: true, enabled: Boolean(data.enabled) };
  } catch (err) {
    return {
      ok: false,
      enabled: !enabled,
      error: errorMessage(err),
    };
  }
}

export async function sendLowBatteryNotification(
  title: string,
  body: string,
): Promise<void> {
  const request: NotificationActionRequest = {
    action: "send_low_battery_alert",
    title,
    body,
  };
  if (isTauriDesktopRuntime()) {
    try {
      await invoke("send_low_battery_notification", { request });
    } catch {
      // Ignore notification backend error
    }
    return;
  }

  try {
    await fetch("/api/local/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    // Ignore error
  }
}

export async function setWidgetPinned(
  pinned: boolean,
): Promise<PinToggleResult> {
  if (!isTauriDesktopRuntime()) {
    return { ok: true, pinned };
  }
  try {
    const actual = await invoke<boolean>("set_widget_pinned", { pinned });
    return { ok: true, pinned: actual };
  } catch (err) {
    return {
      ok: false,
      pinned: !pinned,
      error: errorMessage(err),
    };
  }
}

export async function hideWidgetWindow(): Promise<void> {
  if (!isTauriDesktopRuntime()) return;
  try {
    await invoke("hide_widget");
  } catch {
    // Ignore error
  }
}
