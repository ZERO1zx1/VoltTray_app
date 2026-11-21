#!/usr/bin/env bash
# VoltTray Linux CLI Installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ZERO1zx1/VoltTray_app/main/scripts/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/ZERO1zx1/VoltTray_app/main/scripts/install.sh | bash -s -- --autostart --m220-udev
set -euo pipefail

REPO="ZERO1zx1/VoltTray_app"
APP_ID="app.volttray.monitor"
VERSION="latest"
AUTOSTART=1
M220_UDEV=0
UNINSTALL=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="${2:?Missing tag for --version}"
      shift 2
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

log() { printf '[volttray] %s\n' "$*"; }

if [[ "$UNINSTALL" -eq 1 ]]; then
  log "Uninstalling VoltTray..."
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] Would remove: $APP_DIR, $BIN_DIR/volttray, $DESKTOP_FILE, $AUTOSTART_FILE"
    exit 0
  fi
  rm -rf "$APP_DIR"
  rm -f "$BIN_DIR/volttray" "$DESKTOP_FILE" "$AUTOSTART_FILE"
  log "VoltTray removed."
  exit 0
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ASSET_PATTERN="AppImage" ;;
  *)
    echo "Unsupported Linux architecture for prebuilt binary: $ARCH. Build from source with: git clone https://github.com/$REPO && npm run tauri:build" >&2
    exit 1
    ;;
esac

if [[ "$VERSION" == "latest" ]]; then
  API_URL="https://api.github.com/repos/$REPO/releases/latest"
else
  API_URL="https://api.github.com/repos/$REPO/releases/tags/$VERSION"
fi

log "Target binary: $TARGET_BIN"
if [[ "$DRY_RUN" -eq 1 ]]; then
  log "[dry-run] Fetch release metadata from $API_URL"
  log "[dry-run] Install AppImage to $TARGET_BIN and link $BIN_DIR/volttray"
  log "[dry-run] Write desktop entry $DESKTOP_FILE (autostart=$AUTOSTART, m220_udev=$M220_UDEV)"
  exit 0
fi

command -v curl >/dev/null 2>&1 || { echo "curl is required." >&2; exit 1; }

RELEASE_JSON="$(curl -fsSL -H 'Accept: application/vnd.github+json' "$API_URL")"
DOWNLOAD_URL="$(printf '%s\n' "$RELEASE_JSON" | grep -oE 'https://[^"]+\.AppImage' | head -n 1 || true)"

if [[ -z "$DOWNLOAD_URL" ]]; then
  echo "No .$ASSET_PATTERN release asset found at $API_URL. Build from source with 'npm run install:cli -- install --from-source'." >&2
  exit 1
fi

mkdir -p "$APP_DIR" "$BIN_DIR" "$DATA_DIR/applications"
TMP_BIN="$TARGET_BIN.download"
log "Downloading $DOWNLOAD_URL..."
curl -fL --progress-bar "$DOWNLOAD_URL" -o "$TMP_BIN"
chmod 755 "$TMP_BIN"
mv -f "$TMP_BIN" "$TARGET_BIN"
ln -sf "$TARGET_BIN" "$BIN_DIR/volttray"

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
log "Run 'volttray' or launch VoltTray from your application menu."
