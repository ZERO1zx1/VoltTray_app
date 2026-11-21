#!/usr/bin/env bash
# Install an already-built native app for the current Linux user, without sudo.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}"
APP_DIR="$DATA_DIR/volttray"
SOURCE="$ROOT_DIR/src-tauri/target/release/volttray"

if [[ ! -x "$SOURCE" ]]; then
  echo "Build first: npm run tauri:build -- --no-bundle" >&2
  exit 1
fi

# Desktop Entry Exec quoting has an additional backslash-unescaping layer.
desktop_exec() {
  local value="$1"
  value="${value//\\/\\\\\\\\}"
  value="${value//\"/\\\\\"}"
  value="${value//\$/\\\\\$}"
  value="${value//\`/\\\\\`}"
  value="${value//%/%%}"
  printf '"%s"' "$value"
}

mkdir -p "$APP_DIR" "$DATA_DIR/applications" "$DATA_DIR/icons/hicolor/128x128/apps" "$DATA_DIR/icons/hicolor/512x512/apps"
# Rename avoids overwriting an executable that may still be running.
install -m 755 "$SOURCE" "$APP_DIR/volttray.new"
mv -f "$APP_DIR/volttray.new" "$APP_DIR/volttray"
install -m 644 "$ROOT_DIR/src-tauri/icons/128x128.png" "$DATA_DIR/icons/hicolor/128x128/apps/volttray.png"
install -m 644 "$ROOT_DIR/src-tauri/icons/icon.png" "$DATA_DIR/icons/hicolor/512x512/apps/volttray.png"
EXEC_VALUE="$(desktop_exec "$APP_DIR/volttray")"
write_entry() {
cat <<EOF
[Desktop Entry]
Type=Application
Name=VoltTray
Comment=Battery monitor for connected devices
Exec=$EXEC_VALUE${1:-}
Icon=volttray
Terminal=false
Categories=Utility;
StartupNotify=false
EOF
}
write_entry > "$DATA_DIR/applications/app.volttray.monitor.desktop"

# Preserve the user's choice; only migrate an already-enabled startup entry.
if [[ -f "$CONFIG_DIR/autostart/volttray.desktop" ]]; then
  write_entry ' --minimized' > "$CONFIG_DIR/autostart/volttray.desktop"
fi
if command -v update-desktop-database >/dev/null; then
  update-desktop-database "$DATA_DIR/applications"
fi
echo "Installed: $APP_DIR/volttray"
echo "Open VoltTray from your application menu."
