#!/usr/bin/env bash
# VoltTray Linux CLI Installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ZERO1zx1/VoltTray_app/main/scripts/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/ZERO1zx1/VoltTray_app/main/scripts/install.sh | bash -s -- --from-source --autostart --m220-udev
set -euo pipefail

REPO="ZERO1zx1/VoltTray_app"
APP_ID="app.volttray.monitor"
VERSION="latest"
AUTOSTART=1
M220_UDEV=0
UNINSTALL=0
DRY_RUN=0
FROM_SOURCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="${2:?Missing tag for --version}"
      shift 2
      ;;
    --from-source)
      FROM_SOURCE=1
      shift
      ;;
    --autostart)
      AUTOSTART=1
      shift
      ;;
    --no-autostart)
      AUTOSTART=0
      shift
      ;;
    --m220-udev)
      M220_UDEV=1
      shift
      ;;
    --uninstall)
      UNINSTALL=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      cat <<'EOF'
VoltTray Linux CLI Installer

Options:
  --version <tag>   Install a specific release tag (default: latest)
  --from-source     Clone and build native binary locally (requires git, node, npm, cargo)
  --autostart       Create XDG autostart entry (default)
  --no-autostart    Skip XDG autostart entry
  --m220-udev       Install interface-02 M220 udev rule (requires sudo)
  --uninstall       Remove VoltTray from ~/.local
  --dry-run         Print actions without modifying the system
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"
BIN_DIR="$HOME/.local/bin"
APP_DIR="$DATA_DIR/volttray"
TARGET_BIN="$APP_DIR/volttray"
DESKTOP_FILE="$DATA_DIR/applications/$APP_ID.desktop"
AUTOSTART_FILE="$CONFIG_DIR/autostart/volttray.desktop"
ICON_128="$DATA_DIR/icons/hicolor/128x128/apps/volttray.png"
ICON_512="$DATA_DIR/icons/hicolor/512x512/apps/volttray.png"

log() { printf '[volttray] %s\n' "$*"; }

if [[ "$UNINSTALL" -eq 1 ]]; then
  log "Uninstalling VoltTray..."
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] Would remove: $APP_DIR, $BIN_DIR/volttray, $DESKTOP_FILE, $AUTOSTART_FILE, $ICON_128, $ICON_512"
    exit 0
  fi
  rm -rf "$APP_DIR"
  rm -f "$BIN_DIR/volttray" "$DESKTOP_FILE" "$AUTOSTART_FILE" "$ICON_128" "$ICON_512"
  log "VoltTray removed."
  exit 0
fi

if [[ "$VERSION" == "latest" ]]; then
  API_URL="https://api.github.com/repos/$REPO/releases/latest"
else
  API_URL="https://api.github.com/repos/$REPO/releases/tags/$VERSION"
fi

log "Target binary: $TARGET_BIN"
if [[ "$DRY_RUN" -eq 1 ]]; then
  if [[ "$FROM_SOURCE" -eq 1 ]]; then
    log "[dry-run] Clone https://github.com/$REPO.git and build native binary via 'npm run tauri:build -- --no-bundle'"
  else
    log "[dry-run] Fetch release metadata from $API_URL (falls back to source build if no release is published)"
  fi
  log "[dry-run] Install binary to $TARGET_BIN and link $BIN_DIR/volttray"
  log "[dry-run] Write desktop entry $DESKTOP_FILE (autostart=$AUTOSTART, m220_udev=$M220_UDEV)"
  exit 0
fi

command -v curl >/dev/null 2>&1 || { echo "[volttray] Error: curl is required." >&2; exit 1; }

build_from_source() (
  local missing=()
  for tool in git node npm cargo; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      missing+=("$tool")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "" >&2
    echo "[volttray] Cannot build from source because required tools are missing: ${missing[*]}" >&2
    echo "[volttray] Option 1: Publish a v1.0.0 release on https://github.com/$REPO/releases (via git tag v1.0.0 && git push origin v1.0.0)." >&2
    echo "[volttray] Option 2: Install build tools (e.g. on Arch: sudo pacman -S git nodejs npm rust webkit2gtk-4.1 libappindicator-gtk3 librsvg) and re-run with --from-source." >&2
    exit 1
  fi

  local tmp_src
  tmp_src="$(mktemp -d)"
  trap 'rm -rf "$tmp_src"' EXIT

  log "Cloning https://github.com/$REPO.git..."
  local clone_args=(--depth 1)
  if [[ "$VERSION" != "latest" ]]; then
    clone_args+=(--branch "$VERSION")
  fi
  git clone "${clone_args[@]}" "https://github.com/$REPO.git" "$tmp_src/volttray"
  cd "$tmp_src/volttray"

  log "Installing npm dependencies..."
  npm ci --no-audit --no-fund

  log "Building native VoltTray binary (this may take a few minutes on first compile)..."
  npm run tauri:build -- --no-bundle

  local built_bin="$tmp_src/volttray/src-tauri/target/release/volttray"
  if [[ ! -x "$built_bin" ]]; then
    echo "[volttray] Error: Expected built binary not found at $built_bin" >&2
    exit 1
  fi

  mkdir -p "$APP_DIR" "$BIN_DIR" "$DATA_DIR/applications" "$(dirname "$ICON_128")" "$(dirname "$ICON_512")"
  install -m 755 "$built_bin" "$TARGET_BIN.new"
  mv -f "$TARGET_BIN.new" "$TARGET_BIN"
  ln -sf "$TARGET_BIN" "$BIN_DIR/volttray"

  if [[ -f "$tmp_src/volttray/src-tauri/icons/128x128.png" ]]; then
    install -m 644 "$tmp_src/volttray/src-tauri/icons/128x128.png" "$ICON_128"
  fi
  if [[ -f "$tmp_src/volttray/src-tauri/icons/icon.png" ]]; then
    install -m 644 "$tmp_src/volttray/src-tauri/icons/icon.png" "$ICON_512"
  fi
)

install_from_release() {
  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) ;;
    *)
      log "No prebuilt Linux AppImage for architecture '$arch'; switching to source build..."
      return 1
      ;;
  esac

  local tmp_json http_code
  tmp_json="$(mktemp)"
  http_code="$(curl -sSL -H 'Accept: application/vnd.github+json' -H 'User-Agent: volttray-installer' -w '%{http_code}' -o "$tmp_json" "$API_URL" || true)"

  if [[ "$http_code" != "200" ]]; then
    rm -f "$tmp_json"
    if [[ "$http_code" == "404" ]]; then
      log "No published GitHub Release found yet at $REPO ($VERSION)."
    else
      log "GitHub Releases API returned HTTP $http_code."
    fi
    return 1
  fi

  local download_url
  download_url="$(grep -oE 'https://[^"]+\.AppImage' "$tmp_json" | head -n 1 || true)"
  rm -f "$tmp_json"

  if [[ -z "$download_url" ]]; then
    log "Published release '$VERSION' does not contain an .AppImage asset."
    return 1
  fi

  command -v sha256sum >/dev/null 2>&1 || { log "Error: sha256sum is required." >&2; return 2; }
  local download_dir tmp_bin manifest expected actual asset_name
  download_dir="$(mktemp -d)" || return 2
  tmp_bin="$download_dir/volttray.AppImage"
  manifest="$download_dir/SHA256SUMS.txt"
  asset_name="${download_url##*/}"
  log "Downloading $download_url..."
  if ! curl -fL --progress-bar "$download_url" -o "$tmp_bin" \
    || ! curl -fsSL "${download_url%/*}/SHA256SUMS.txt" -o "$manifest"; then
    rm -rf "$download_dir"
    log "Error: release or checksum download failed; nothing was installed." >&2
    return 2
  fi
  expected="$(awk -v name="$asset_name" 'length($1) == 64 && substr($0, 67) == name { print $1 }' "$manifest")"
  actual="$(sha256sum "$tmp_bin")"
  actual="${actual%% *}"
  if [[ ! "$expected" =~ ^[[:xdigit:]]{64}$ ]] || [[ "${expected,,}" != "$actual" ]]; then
    rm -rf "$download_dir"
    log "Error: SHA-256 verification failed; nothing was installed." >&2
    return 2
  fi
  mkdir -p "$APP_DIR" "$BIN_DIR" "$DATA_DIR/applications" "$(dirname "$ICON_128")" "$(dirname "$ICON_512")" || { rm -rf "$download_dir"; return 2; }
  if ! install -m 755 "$tmp_bin" "$TARGET_BIN.new" \
    || ! mv -f "$TARGET_BIN.new" "$TARGET_BIN" \
    || ! ln -sf "$TARGET_BIN" "$BIN_DIR/volttray"; then
    rm -rf "$download_dir"
    return 2
  fi
  rm -rf "$download_dir"

  # Fetch icons from repo so application menu shows the VoltTray icon
  curl -fsSL "https://raw.githubusercontent.com/$REPO/main/src-tauri/icons/128x128.png" -o "$ICON_128" 2>/dev/null || true
  curl -fsSL "https://raw.githubusercontent.com/$REPO/main/src-tauri/icons/icon.png" -o "$ICON_512" 2>/dev/null || true
  return 0
}

if [[ "$FROM_SOURCE" -eq 1 ]]; then
  build_from_source
else
  if install_from_release; then
    :
  else
    result=$?
    if [[ "$result" -ne 1 ]]; then exit "$result"; fi
    log "Falling back to local source build..."
    build_from_source
  fi
fi

write_desktop() {
  cat <<EOF
[Desktop Entry]
Type=Application
Name=VoltTray
Comment=Local-first battery monitor for connected devices
Exec="$TARGET_BIN"${1:-}
Icon=volttray
Terminal=false
Categories=Utility;System;
StartupNotify=false
EOF
}

write_desktop > "$DESKTOP_FILE"
if [[ "$AUTOSTART" -eq 1 ]]; then
  mkdir -p "$CONFIG_DIR/autostart"
  write_desktop ' --minimized' > "$AUTOSTART_FILE"
fi

if [[ "$M220_UDEV" -eq 1 ]]; then
  RULE_URL="https://raw.githubusercontent.com/$REPO/main/src-tauri/linux/70-volttray-m220.rules"
  TMP_RULE="$(mktemp)"
  curl -fsSL "$RULE_URL" -o "$TMP_RULE"
  sudo install -m 0644 "$TMP_RULE" /etc/udev/rules.d/70-volttray-m220.rules
  rm -f "$TMP_RULE"
  sudo udevadm control --reload-rules
  sudo udevadm trigger --action=change --subsystem-match=hidraw
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DATA_DIR/applications" >/dev/null 2>&1 || true
fi

log "Installed VoltTray to $TARGET_BIN"
log "Run 'volttray' (ensure ~/.local/bin is in PATH) or launch VoltTray from your application menu."
