import fs from "node:fs";
import path from "node:path";
import { INITIAL_SETTINGS } from "../../lib/defaults";
import type { AppSettings, LowBatteryThreshold } from "../../lib/types";

export interface PersistedLocalState {
  settings: AppSettings;
}

function sanitizeSettings(raw?: Partial<AppSettings> | null): AppSettings {
  const locale = raw?.locale === "en" || raw?.locale === "mn"
    ? raw.locale
    : INITIAL_SETTINGS.locale;
  const threshold: LowBatteryThreshold =
    raw?.lowBatteryThresholdPct === 10 ||
    raw?.lowBatteryThresholdPct === 15 ||
    raw?.lowBatteryThresholdPct === 20
      ? raw.lowBatteryThresholdPct
      : INITIAL_SETTINGS.lowBatteryThresholdPct;

  return {
    locale,
    notificationsEnabled:
      typeof raw?.notificationsEnabled === "boolean"
        ? raw.notificationsEnabled
        : INITIAL_SETTINGS.notificationsEnabled,
    lowBatteryThresholdPct: threshold,
    launchAtLogin:
      typeof raw?.launchAtLogin === "boolean"
        ? raw.launchAtLogin
        : INITIAL_SETTINGS.launchAtLogin,
  };
}

export class LocalDiskStore {
  private readonly dirPath: string;
  private readonly statePath: string;
  private cachedState: PersistedLocalState | null = null;

  constructor(baseDir = path.resolve(process.cwd(), ".volttray")) {
    this.dirPath = baseDir;
    this.statePath = path.join(baseDir, "state.json");
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true, mode: 0o700 });
    }
  }

  public loadState(): PersistedLocalState {
    if (this.cachedState) return this.cachedState;

    try {
      if (fs.existsSync(this.statePath)) {
        const raw = fs.readFileSync(this.statePath, "utf8");
        const parsed = JSON.parse(raw) as Partial<PersistedLocalState>;
        this.cachedState = {
          settings: sanitizeSettings(parsed.settings),
        };
        return this.cachedState;
      }
    } catch {
      // Fall back to clean defaults if state file is corrupted
    }

    this.cachedState = { settings: { ...INITIAL_SETTINGS } };
    return this.cachedState;
  }

  public saveState(next: Partial<PersistedLocalState>): PersistedLocalState {
    const current = this.loadState();
    const merged: PersistedLocalState = {
      settings: sanitizeSettings({
        ...current.settings,
        ...(next.settings ?? {}),
      }),
    };
    this.cachedState = merged;
    this.ensureDir();
    const tmpPath = `${this.statePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(tmpPath, this.statePath);
    return merged;
  }
}
