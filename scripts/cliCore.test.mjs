import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInstallPlan,
  formatDesktopEntry,
  parseCliArgs,
  selectReleaseAsset,
} from "./cliCore.mjs";

test("parseCliArgs parses commands, flags, language, and rejects invalid arguments", () => {
  const parsed = parseCliArgs([
    "install",
    "--from-release",
    "--version",
    "v1.2.0",
    "--no-autostart",
    "--m220-udev",
    "--dry-run",
    "--lang",
    "mn",
  ]);
  assert.equal(parsed.error, null);
  assert.equal(parsed.command, "install");
  assert.equal(parsed.source, "release");
  assert.equal(parsed.releaseTag, "v1.2.0");
  assert.equal(parsed.autostart, false);
  assert.equal(parsed.m220Udev, true);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.lang, "mn");

  assert.ok(parseCliArgs(["install", "--unknown"]).error);
  assert.ok(parseCliArgs(["install", "--lang", "fr"]).error);
  assert.ok(parseCliArgs(["install", "--version"]).error);
  assert.ok(parseCliArgs(["badcmd"]).error);
});

test("selectReleaseAsset picks platform-appropriate installers and ignores mismatches", () => {
  const assets = [
    { name: "VoltTray_1.0.0_amd64.AppImage", browser_download_url: "https://example.test/appimage" },
    { name: "VoltTray_1.0.0_amd64.deb", browser_download_url: "https://example.test/deb" },
    { name: "VoltTray_1.0.0_x64-setup.exe", browser_download_url: "https://example.test/setup.exe" },
    { name: "VoltTray_1.0.0_x64_en-US.msi", browser_download_url: "https://example.test/msi" },
  ];

  assert.equal(selectReleaseAsset(assets, "linux", "x64")?.kind, "appimage");
  assert.equal(selectReleaseAsset(assets.slice(1), "linux", "x64")?.kind, "deb");
  assert.equal(selectReleaseAsset(assets, "win32", "x64")?.kind, "nsis");
  assert.equal(selectReleaseAsset(assets, "darwin", "arm64"), null);
});

test("buildInstallPlan generates predictable Linux, Windows, and uninstall steps", () => {
  const linuxPlan = buildInstallPlan(
    parseCliArgs(["install", "--from-source", "--autostart", "--m220-udev"]),
    { platform: "linux", homeDir: "/home/demo", hasLocalRepo: true },
  );
  assert.equal(linuxPlan.mode, "source");
  assert.deepEqual(
    linuxPlan.steps.map((s) => s.id),
    ["build-tauri", "install-binary", "link-bin", "write-desktop-entry", "write-autostart", "install-m220-udev"],
  );

  const winPlan = buildInstallPlan(
    parseCliArgs(["install", "--from-release", "--autostart"]),
    { platform: "win32", homeDir: "C:\\Users\\demo", localAppData: "C:\\Users\\demo\\AppData\\Local", hasLocalRepo: false },
  );
  assert.equal(winPlan.mode, "release");
  assert.deepEqual(
    winPlan.steps.map((s) => s.id),
    ["fetch-release", "install-release-asset", "register-win-autostart"],
  );

  const uninstallKeepConfig = buildInstallPlan(
    parseCliArgs(["uninstall"]),
    { platform: "linux", homeDir: "/home/demo", hasLocalRepo: true },
  );
  assert.equal(uninstallKeepConfig.steps.some((s) => s.id === "purge-config"), false);

  const uninstallPurge = buildInstallPlan(
    parseCliArgs(["uninstall", "--purge"]),
    { platform: "linux", homeDir: "/home/demo", hasLocalRepo: true },
  );
  assert.equal(uninstallPurge.steps.some((s) => s.id === "purge-config"), true);
});

test("formatDesktopEntry escapes special characters and supports --minimized", () => {
  const entry = formatDesktopEntry('/home/user/My "App"/volttray', "--minimized");
  assert.match(entry, /Exec="\/home\/user\/My \\\\"App\\\\"\/volttray" --minimized/);
  assert.match(entry, /Name=VoltTray/);
});
