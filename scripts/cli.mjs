#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  APP_VERSION,
  CLI_STRINGS,
  REPO_SLUG,
  buildInstallPlan,
  formatDesktopEntry,
  parseCliArgs,
  selectReleaseAsset,
  verifyReleaseChecksum,
} from "./cliCore.mjs";

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const c = {
  green: (s) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const hasLocalRepo = fs.existsSync(path.join(repoRoot, "src-tauri", "Cargo.toml"));

function commandVersion(cmd, args = ["--version"]) {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  if (res.error || res.status !== 0) return null;
  return (res.stdout || res.stderr || "").trim().split("\n")[0] || "installed";
}

function runChecked(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(" ")}`);
  }
}

function runDoctor(lang) {
  const t = CLI_STRINGS[lang];
  console.log(`\n${c.bold(t.doctorHeader)} (${process.platform} / ${process.arch})\n`);

  const checks = [
    { name: "node", req: true, val: commandVersion("node", ["-v"]) },
    { name: "npm", req: true, val: commandVersion("npm", ["-v"]) },
    { name: "rustc", req: false, val: commandVersion("rustc", ["--version"]) },
    { name: "cargo", req: false, val: commandVersion("cargo", ["--version"]) },
  ];

  if (process.platform === "linux") {
    checks.push(
      { name: "upower", req: false, val: commandVersion("upower", ["--version"]) },
      { name: "notify-send", req: false, val: commandVersion("notify-send", ["--version"]) },
      { name: "busctl", req: false, val: commandVersion("busctl", ["--version"]) },
    );
  } else if (process.platform === "win32") {
    checks.push({
      name: "powershell",
      req: true,
      val: commandVersion("powershell", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"]),
    });
  }

  let hasMissingRequired = false;
  for (const item of checks) {
    if (item.val) {
      console.log(`  ${c.green("[OK]")} ${item.name.padEnd(13)} ${c.dim(item.val)}`);
    } else if (item.req) {
      hasMissingRequired = true;
      console.log(`  ${c.red("[MISSING]")} ${item.name}`);
    } else {
      console.log(`  ${c.yellow("[OPT]")} ${item.name.padEnd(12)} ${c.dim("not installed")}`);
    }
  }
  console.log("");
  if (hasMissingRequired) process.exitCode = 1;
}

async function fetchReleaseAndDownload(tag, destDir) {
  const url =
    tag === "latest"
      ? `https://api.github.com/repos/${REPO_SLUG}/releases/latest`
      : `https://api.github.com/repos/${REPO_SLUG}/releases/tags/${encodeURIComponent(tag)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": `volttray-cli/${APP_VERSION}` },
  });
  if (!res.ok) {
    throw new Error(
      `Could not fetch GitHub Release (${res.status}). Publish a release tag first or use --from-source.`,
    );
  }
  const release = await res.json();
  const picked = selectReleaseAsset(release.assets, process.platform, process.arch);
  if (!picked) {
    throw new Error(`No compatible release asset found for ${process.platform}/${process.arch}.`);
  }
  const checksums = release.assets.find((asset) => asset.name === "SHA256SUMS.txt");
  if (!checksums) throw new Error("Release is missing SHA256SUMS.txt");

  fs.mkdirSync(destDir, { recursive: true });
  const outFile = path.join(destDir, picked.asset.name);
  console.log(`Downloading ${picked.asset.name}...`);
  const dl = await fetch(picked.asset.browser_download_url, {
    headers: { "User-Agent": `volttray-cli/${APP_VERSION}` },
  });
  if (!dl.ok) throw new Error(`Download failed (${dl.status}): ${picked.asset.browser_download_url}`);
  const buf = Buffer.from(await dl.arrayBuffer());
  const sums = await fetch(checksums.browser_download_url);
  if (!sums.ok) throw new Error(`Checksum download failed (${sums.status})`);
  verifyReleaseChecksum(await sums.text(), picked.asset.name, buf);
  fs.writeFileSync(outFile, buf);
  return { kind: picked.kind, filePath: outFile };
}

function removeIfExists(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) return false;
  fs.rmSync(targetPath, { recursive: true, force: true });
  return true;
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  const t = CLI_STRINGS[opts.lang] || CLI_STRINGS.en;

  if (opts.error) {
    console.error(`${c.red("Error:")} ${opts.error}\n`);
    console.log(t.usageBody);
    process.exit(1);
  }

  if (opts.command === "version") {
    console.log(`volttray-installer v${APP_VERSION}`);
    return;
  }

  if (opts.command === "help") {
    console.log(`\n${c.bold(t.usageTitle)} ${c.dim(`v${APP_VERSION}`)}\n`);
    console.log(t.usageBody);
    return;
  }

  if (opts.command === "doctor") {
    runDoctor(opts.lang);
    return;
  }

  const envInfo = {
    platform: process.platform,
    homeDir: os.homedir(),
    xdgDataHome: process.env.XDG_DATA_HOME,
    xdgConfigHome: process.env.XDG_CONFIG_HOME,
    localAppData: process.env.LOCALAPPDATA,
    hasLocalRepo,
  };

  const plan = buildInstallPlan(opts, envInfo);

  console.log(`\n${c.bold(t.planHeader)} (${plan.mode} · ${process.platform})\n`);
  for (const [idx, step] of plan.steps.entries()) {
    console.log(`  ${c.dim(`${idx + 1}.`)} ${step.id.padEnd(22)} ${c.dim(step.target)}`);
  }
  console.log("");

  if (opts.dryRun) {
    console.log(c.yellow(t.dryRunNote));
    return;
  }

  if (opts.command === "uninstall") {
    for (const step of plan.steps) {
      if (removeIfExists(step.target)) {
        console.log(`  ${c.green("[REMOVED]")} ${step.target}`);
      }
    }
    if (process.platform === "win32") {
      spawnSync(
        "reg",
        ["delete", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "VoltTray", "/f"],
        { stdio: "ignore" },
      );
    }
    console.log(`\n${c.green(t.doneUninstall)}`);
    return;
  }

  // Install flow
  if (plan.mode === "release") {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "volttray-"));
    try {
      const downloaded = await fetchReleaseAndDownload(opts.releaseTag, tmpDir);
      fs.mkdirSync(plan.paths.appDir, { recursive: true });
      if (downloaded.kind === "appimage") {
        const staging = `${plan.paths.binaryPath}.new`;
        fs.copyFileSync(downloaded.filePath, staging);
        fs.chmodSync(staging, 0o755);
        fs.renameSync(staging, plan.paths.binaryPath);
      } else if (downloaded.kind === "deb") {
        runChecked("sudo", ["dpkg", "-i", downloaded.filePath]);
      } else if (downloaded.kind === "nsis") {
        runChecked(downloaded.filePath, ["/S"]);
      } else if (downloaded.kind === "msi") {
        runChecked("msiexec", ["/i", downloaded.filePath, "/qn"]);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } else {
    if (!hasLocalRepo) {
      throw new Error("Local repository not found. Re-run with --from-release.");
    }
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    runChecked(npmCmd, ["run", "tauri:build", "--", "--no-bundle"], { cwd: repoRoot });

    const builtBinary = path.join(
      repoRoot,
      "src-tauri",
      "target",
      "release",
      process.platform === "win32" ? "volttray.exe" : "volttray",
    );
    if (!fs.existsSync(builtBinary)) {
      throw new Error(`Expected built binary not found: ${builtBinary}`);
    }
    fs.mkdirSync(plan.paths.appDir, { recursive: true });
    const staging = `${plan.paths.binaryPath}.new`;
    fs.copyFileSync(builtBinary, staging);
    if (process.platform !== "win32") fs.chmodSync(staging, 0o755);
    fs.renameSync(staging, plan.paths.binaryPath);
  }

  if (process.platform === "linux") {
    if (plan.paths.binSymlink && fs.existsSync(plan.paths.binaryPath)) {
      fs.mkdirSync(path.dirname(plan.paths.binSymlink), { recursive: true });
      removeIfExists(plan.paths.binSymlink);
      fs.symlinkSync(plan.paths.binaryPath, plan.paths.binSymlink);
    }

    const iconSrc = path.join(repoRoot, "src-tauri", "icons", "icon.png");
    if (fs.existsSync(iconSrc) && plan.paths.iconDest) {
      fs.mkdirSync(path.dirname(plan.paths.iconDest), { recursive: true });
      fs.copyFileSync(iconSrc, plan.paths.iconDest);
    }

    if (plan.paths.desktopEntry) {
      fs.mkdirSync(path.dirname(plan.paths.desktopEntry), { recursive: true });
      fs.writeFileSync(plan.paths.desktopEntry, formatDesktopEntry(plan.paths.binaryPath));
    }

    if (opts.autostart && plan.paths.autostartEntry) {
      fs.mkdirSync(path.dirname(plan.paths.autostartEntry), { recursive: true });
      fs.writeFileSync(
        plan.paths.autostartEntry,
        formatDesktopEntry(plan.paths.binaryPath, "--minimized"),
      );
    }

    if (opts.m220Udev) {
      const ruleSrc = path.join(repoRoot, "src-tauri", "linux", "70-volttray-m220.rules");
      if (!fs.existsSync(ruleSrc)) {
        throw new Error(`M220 rule file not found: ${ruleSrc}`);
      }
      runChecked("sudo", ["install", "-m", "0644", ruleSrc, plan.paths.m220RuleDest]);
      runChecked("sudo", ["udevadm", "control", "--reload-rules"]);
      runChecked("sudo", ["udevadm", "trigger", "--action=change", "--subsystem-match=hidraw"]);
    }
  } else if (process.platform === "win32" && opts.autostart && fs.existsSync(plan.paths.binaryPath)) {
    runChecked("reg", [
      "add",
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
      "/v",
      "VoltTray",
      "/t",
      "REG_SZ",
      "/d",
      `"${plan.paths.binaryPath}" --minimized`,
      "/f",
    ]);
  }

  console.log(`\n${c.green(t.doneInstall)}`);
}

main().catch((err) => {
  console.error(`\n${c.red("Error:")} ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
