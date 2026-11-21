#!/bin/bash
# Restart the public Next.js process without hanging on a stuck PM2 daemon.
set -u
timeout 15 pm2 restart liveshow-web --update-env >/dev/null 2>&1 || true
if timeout 8 pm2 describe liveshow-web >/dev/null 2>&1; then
    timeout 8 pm2 status || true
    exit 0
fi
echo "pm2 beragadt — Next folyamat újraindítása"
pkill -f "next start -p 3000" || true
sleep 2
timeout 15 pm2 start liveshow-web >/dev/null 2>&1 || timeout 15 pm2 restart liveshow-web >/dev/null 2>&1 || true
sleep 2
curl -sS --max-time 8 -o /dev/null -w "web:%{http_code}\n" http://127.0.0.1:3000/ || true
