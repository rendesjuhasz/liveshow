#!/usr/bin/env bash
# B3: LiveKit / TURN / RTC ports. TCP 7880 stays localhost (Nginx).
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "sudo bash $0" >&2
  exit 1
fi

if ! command -v ufw >/dev/null 2>&1; then
  echo "ufw nincs telepítve. Telepítsd: apt install ufw" >&2
  exit 1
fi

ufw allow 22/tcp comment 'ssh'
ufw allow 80/tcp comment 'http acme'
ufw allow 443/tcp comment 'https web api livekit wss'
ufw allow 50000:50050/udp comment 'livekit rtc'
ufw allow 3478/udp comment 'livekit turn udp'
ufw allow 5349/tcp comment 'livekit turn tls'
ufw --force enable
ufw status verbose
