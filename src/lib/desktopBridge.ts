import type { AppSettings, PeripheralDevice } from "./types";

interface TauriInternals {
  invoke: <T = unknown>(
    cmd: string,
    args?: Record<string, unknown>,
  ) => Promise<T>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

export interface LocalBootstrapPayload {
  mode?: string;
  os?: string;
  chargerConnected?: boolean;
  autostartEnabled?: boolean;
  probedHardwareCount?: number;
  settings?: Partial<AppSettings> | null;
  devices?: PeripheralDevice[];
}

export interface HardwareActionRequest {
  action: "send_low_battery_alert";
  title?: string;
  body?: string;
}

export function isTauriDesktopRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.__TAURI_INTERNALS__?.invoke === "function"
  );
}

export async function loadLocalBootstrap(
  force = false,
): Promise<LocalBootstrapPayload | null> {
  if (isTauriDesktopRuntime()) {
    try {
      return await window.__TAURI_INTERNALS__!.invoke<LocalBootstrapPayload>(
        "get_local_bootstrap",
        { force },
      );
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
      await window.__TAURI_INTERNALS__!.invoke("save_local_state", {
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

export async function toggleOsAutostart(enabled: boolean): Promise<boolean> {
  if (isTauriDesktopRuntime()) {
    try {
      return await window.__TAURI_INTERNALS__!.invoke<boolean>(
        "set_autostart",
        { enabled },
      );
    } catch {
      return enabled;
    }
  }

  try {
    const res = await fetch("/api/local/autostart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      const data = (await res.json()) as { enabled?: boolean };
      return Boolean(data.enabled);
    }
  } catch {
    // Ignore local web autostart error
  }
  return enabled;
}

export async function sendLowBatteryNotification(
  title: string,
  body: string,
): Promise<void> {
  const request: HardwareActionRequest = {
    action: "send_low_battery_alert",
    title,
    body,
  };
  if (isTauriDesktopRuntime()) {
    try {
      await window.__TAURI_INTERNALS__!.invoke("run_linux_hardware_action", {
        request,
      });
    } catch {
      // Ignore error
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

export async function setWidgetPinned(pinned: boolean): Promise<boolean> {
  if (!isTauriDesktopRuntime()) return pinned;
  try {
    return await window.__TAURI_INTERNALS__!.invoke<boolean>(
      "set_widget_pinned",
      { pinned },
    );
  } catch {
    return pinned;
  }
}

export async function hideWidgetWindow(): Promise<void> {
  if (!isTauriDesktopRuntime()) return;
  try {
    await window.__TAURI_INTERNALS__!.invoke("hide_widget");
  } catch {
    // Ignore error
  }
}
