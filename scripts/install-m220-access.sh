#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
sudo install -m 0644 "$project_dir/src-tauri/linux/70-volttray-m220.rules" /etc/udev/rules.d/70-volttray-m220.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --action=change --subsystem-match=hidraw
echo 'M220 interface access configured. Unplug/replug the mouse and receiver if needed, then wait 30 seconds and Refresh.'
