#!/bin/bash
# Run on the VPS as root from the repo (after git pull + backend build).
set -euo pipefail
ROOT="${LIVESHOW_ROOT:-/var/www/liveshow}"
UNIT_DIR="$ROOT/deploy/systemd"

if [[ ! -f "$ROOT/backend/dist/main.js" ]]; then
    echo "Hiányzik $ROOT/backend/dist/main.js — előbb: cd backend && npm run build" >&2
    exit 1
fi
if [[ ! -x "$UNIT_DIR/liveshow-api-watchdog.sh" ]]; then
    chmod +x "$UNIT_DIR/liveshow-api-watchdog.sh"
fi

install -d /var/lib/liveshow
install -m 644 "$UNIT_DIR/liveshow-api.service" /etc/systemd/system/liveshow-api.service
install -m 644 "$UNIT_DIR/liveshow-api-watchdog.service" /etc/systemd/system/liveshow-api-watchdog.service
install -m 644 "$UNIT_DIR/liveshow-api-watchdog.timer" /etc/systemd/system/liveshow-api-watchdog.timer

if command -v pm2 >/dev/null 2>&1; then
    timeout 8 pm2 stop liveshow-api >/dev/null 2>&1 || true
    timeout 8 pm2 delete liveshow-api >/dev/null 2>&1 || true
fi
fuser -k -9 3200/tcp 2>/dev/null || true
sleep 1

systemctl daemon-reload
systemctl enable --now liveshow-api.service
systemctl enable --now liveshow-api-watchdog.timer
sleep 8
curl -sS --max-time 8 http://127.0.0.1:3200/health || true
echo
systemctl --no-pager --full status liveshow-api.service | head -n 20
echo
systemctl --no-pager --full status liveshow-api-watchdog.timer | head -n 12
