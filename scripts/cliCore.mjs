import path from "node:path";
import { createHash } from "node:crypto";

export const REPO_SLUG = "ZERO1zx1/VoltTray_app";
export const APP_ID = "app.volttray.monitor";
export const APP_VERSION = "1.0.0";

export const CLI_STRINGS = {
  en: {
    usageTitle: "VoltTray CLI Installer",
    usageBody: `Usage:
  volttray-installer <command> [options]

Commands:
  install       Install VoltTray (from GitHub Release or local source)
  uninstall     Remove VoltTray binary, launcher, and autostart entries
  doctor        Inspect system prerequisites (Node, Rust, OS tools)
  help          Show this help message

Options:
  --from-release        Download prebuilt binary/installer from GitHub Releases
  --from-source         Build and install from local source (default inside repo)
  --version <tag>       Specific release tag (e.g. v1.0.0) with --from-release
  --autostart           Enable launch-at-login desktop entry
  --no-autostart        Skip creating autostart entry
  --m220-udev           (Linux) Install interface-02 M220 HID udev rule (sudo)
  --purge               (uninstall) Also remove saved preferences (~/.config)
  --dry-run             Print every step without modifying the system
  --lang <en|mn>        CLI output language (default: en)
  -v, --version-info    Print installer version
  -h, --help            Show help`,
    doctorHeader: "System Prerequisite Check",
    planHeader: "Execution Plan",
    dryRunNote: "Dry-run mode enabled — no files or system settings were modified.",
    doneInstall: "VoltTray installation complete.",
    doneUninstall: "VoltTray has been removed.",
  },
  mn: {
    usageTitle: "VoltTray CLI суулгагч",
    usageBody: `Ашиглах заавар:
  volttray-installer <команд> [сонголтууд]

Командууд:
  install       VoltTray суулгах (GitHub Release эсвэл локал эх кодоос)
  uninstall     VoltTray програм, цэсний товч болон авто эхлэлийг устгах
  doctor        Системийн шаардлага шалгах (Node, Rust, OS хэрэгслүүд)
  help          Энэ тусламжийг харуулах

Сонголтууд:
  --from-release        GitHub Releases-ээс бэлэн суулгагч татаж суулгах
  --from-source         Локал эх кодоос угсарч суулгах (repo дотор үндсэн горим)
  --version <tag>       Тодорхой хувилбар сонгох (жнь: v1.0.0)
  --autostart           Систем асахад хамт эхлэх тохиргоог нэмэх
  --no-autostart        Авто эхлэл үүсгэхгүй алгасах
  --m220-udev           (Linux) M220 interface-02 udev дүрэм суулгах (sudo)
  --purge               (uninstall) Хадгалсан тохиргоог (~/.config) хамт устгах
  --dry-run             Системд өөрчлөлт оруулахгүйгээр бүх алхмыг урьдчилж харах
  --lang <en|mn>        CLI хэл сонгох (анхдагч: en)
  -v, --version-info    Суулгагчийн хувилбар харах
  -h, --help            Тусламж харах`,
    doctorHeader: "Системийн орчны шалгалт",
    planHeader: "Гүйцэтгэх төлөвлөгөө",
    dryRunNote: "Туршилтын горим (dry-run) — ямар ч файл, тохиргоо өөрчлөгдсөнгүй.",
    doneInstall: "VoltTray амжилттай суулаа.",
    doneUninstall: "VoltTray амжилттай устгагдлаа.",
  },
};

export function parseCliArgs(argv) {
  const result = {
    command: "help",
    source: "auto", // "auto" | "source" | "release"
    releaseTag: "latest",
    autostart: true,
    m220Udev: false,
    purge: false,
    dryRun: false,
    lang: "en",
    error: null,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      result.command = "help";
      return result;
    }
    if (arg === "-v" || arg === "--version-info") {
      result.command = "version";
      return result;
    }
    if (arg === "--from-release") {
      result.source = "release";
      continue;
    }
    if (arg === "--from-source") {
      result.source = "source";
      continue;
    }
    if (arg === "--autostart") {
      result.autostart = true;
      continue;
    }
    if (arg === "--no-autostart") {
      result.autostart = false;
      continue;
    }
    if (arg === "--m220-udev") {
      result.m220Udev = true;
      continue;
    }
    if (arg === "--purge") {
      result.purge = true;
      continue;
    }
    if (arg === "--dry-run") {
      result.dryRun = true;
      continue;
    }
    if (arg === "--version") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        result.error = "Missing value for --version (example: --version v1.0.0)";
        return result;
      }
      result.releaseTag = next;
      result.source = "release";
      i += 1;
      continue;
    }
    if (arg === "--lang") {
      const next = argv[i + 1];
      if (next !== "en" && next !== "mn") {
        result.error = "Invalid --lang value (expected 'en' or 'mn')";
        return result;
      }
      result.lang = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      result.error = `Unknown option: ${arg}`;
      return result;
    }
    positional.push(arg);
  }

  if (positional.length > 0) {
    const cmd = positional[0];
    if (["install", "uninstall", "doctor", "help", "version"].includes(cmd)) {
      result.command = cmd;
    } else {
      result.error = `Unknown command: ${cmd}`;
    }
  }

  return result;
}

/** Pick the best GitHub Release asset for the target OS and architecture. */
export function selectReleaseAsset(assets, platform, arch) {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const list = assets.filter(
    (a) =>
      a &&
      typeof a.name === "string" &&
      typeof a.browser_download_url === "string",
  );

  if (platform === "linux") {
    if (arch !== "x64" && arch !== "arm64") return null;
    const archTokens = arch === "x64" ? ["amd64", "x86_64"] : ["aarch64", "arm64"];
    const matchesArch = (name) => {
      const low = name.toLowerCase();
      return archTokens.some((t) => low.includes(t)) || (!low.includes("arm") && !low.includes("aarch") && arch === "x64");
    };
    const appImage = list.find(
      (a) => a.name.toLowerCase().endsWith(".appimage") && matchesArch(a.name),
    );
    if (appImage) return { kind: "appimage", asset: appImage };
    const deb = list.find(
      (a) => a.name.toLowerCase().endsWith(".deb") && matchesArch(a.name),
    );
    if (deb) return { kind: "deb", asset: deb };
    return null;
  }

  if (platform === "win32") {
    if (arch !== "x64" && arch !== "arm64") return null;
    const exe = list.find((a) => {
      const low = a.name.toLowerCase();
      return low.endsWith("-setup.exe") || low.endsWith(".exe");
    });
    if (exe) return { kind: "nsis", asset: exe };
    const msi = list.find((a) => a.name.toLowerCase().endsWith(".msi"));
    if (msi) return { kind: "msi", asset: msi };
    return null;
  }

  return null;
}

/** Verify the exact asset entry, rejecting missing, duplicate, or malformed checksums. */
export function verifyReleaseChecksum(manifest, filename, contents) {
  if (path.basename(filename) !== filename || /[\\\r\n]/.test(filename)) {
    throw new Error("Invalid release asset filename");
  }
  const matches = manifest.split(/\r?\n/).flatMap((line) => {
    const match = /^([a-fA-F0-9]{64}) [ *](.+)$/.exec(line);
    return match && match[2] === filename ? [match[1].toLowerCase()] : [];
  });
  if (matches.length !== 1) {
    throw new Error(`Expected one SHA256SUMS.txt entry for ${filename}`);
  }
  const actual = createHash("sha256").update(contents).digest("hex");
  if (matches[0] !== actual) throw new Error(`SHA-256 mismatch for ${filename}`);
}

/** Escape executable path according to XDG Desktop Entry Exec specification. */
export function formatDesktopEntry(execPath, extraArgs = "") {
  const escaped = execPath
    .replace(/\\/g, "\\\\\\\\")
    .replace(/"/g, '\\\\"')
    .replace(/\$/g, "\\\\$")
    .replace(/`/g, "\\\\`")
    .replace(/%/g, "%%");
  const suffix = extraArgs ? ` ${extraArgs.trim()}` : "";
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Name=VoltTray",
    "Comment=Local-first battery monitor for connected devices",
    `Exec="${escaped}"${suffix}`,
    "Icon=volttray",
    "Terminal=false",
    "Categories=Utility;System;",
    "StartupNotify=false",
    "",
  ].join("\n");
}

export function resolveInstallPaths({ platform, homeDir, xdgDataHome, xdgConfigHome, localAppData }) {
  if (platform === "win32") {
    const base = localAppData || path.win32.join(homeDir, "AppData", "Local");
    const appDir = path.win32.join(base, "VoltTray");
    return {
      platform,
      appDir,
      binaryPath: path.win32.join(appDir, "volttray.exe"),
      configDir: path.win32.join(base, APP_ID),
    };
  }
  const dataDir = xdgDataHome || path.posix.join(homeDir, ".local", "share");
  const configDir = xdgConfigHome || path.posix.join(homeDir, ".config");
  const appDir = path.posix.join(dataDir, "volttray");
  return {
    platform,
    appDir,
    binaryPath: path.posix.join(appDir, "volttray"),
    binSymlink: path.posix.join(homeDir, ".local", "bin", "volttray"),
    desktopEntry: path.posix.join(dataDir, "applications", `${APP_ID}.desktop`),
    iconDest: path.posix.join(dataDir, "icons", "hicolor", "128x128", "apps", "volttray.png"),
    autostartEntry: path.posix.join(configDir, "autostart", "volttray.desktop"),
    configDir: path.posix.join(configDir, APP_ID),
    m220RuleDest: "/etc/udev/rules.d/70-volttray-m220.rules",
  };
}

export function buildInstallPlan(options, env) {
  const paths = resolveInstallPaths(env);
  const steps = [];
  const mode = options.source === "auto" ? (env.hasLocalRepo ? "source" : "release") : options.source;

  if (options.command === "uninstall") {
    steps.push({ id: "remove-binary", target: paths.appDir });
    if (paths.binSymlink) steps.push({ id: "remove-symlink", target: paths.binSymlink });
    if (paths.desktopEntry) steps.push({ id: "remove-desktop-entry", target: paths.desktopEntry });
    if (paths.autostartEntry) steps.push({ id: "remove-autostart", target: paths.autostartEntry });
    if (paths.iconDest) steps.push({ id: "remove-icon", target: paths.iconDest });
    if (options.purge) {
      steps.push({ id: "purge-config", target: paths.configDir });
    }
    return { mode: "uninstall", paths, steps };
  }

  if (mode === "release") {
    steps.push({
      id: "fetch-release",
      target: `https://api.github.com/repos/${REPO_SLUG}/releases/${options.releaseTag === "latest" ? "latest" : `tags/${options.releaseTag}`}`,
    });
    steps.push({ id: "install-release-asset", target: paths.binaryPath });
  } else {
    steps.push({ id: "build-tauri", target: "npm run tauri:build -- --no-bundle" });
    steps.push({ id: "install-binary", target: paths.binaryPath });
  }

  if (env.platform === "linux") {
    steps.push({ id: "link-bin", target: paths.binSymlink });
    steps.push({ id: "write-desktop-entry", target: paths.desktopEntry });
    if (options.autostart) {
      steps.push({ id: "write-autostart", target: paths.autostartEntry });
    }
    if (options.m220Udev) {
      steps.push({ id: "install-m220-udev", target: paths.m220RuleDest });
    }
  } else if (env.platform === "win32" && options.autostart) {
    steps.push({
      id: "register-win-autostart",
      target: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\VoltTray",
    });
  }

  return { mode, paths, steps };
}
