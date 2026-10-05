#!/usr/bin/env bash
# B1: install livekit-server + /etc/livekit.yaml + systemd on Ubuntu 22.04/24.04 (amd64).
# Usage (on the media host):
#   sudo DOMAIN=liveshow.hu LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... bash deploy/livekit/install.sh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Futtasd rootként: sudo DOMAIN=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... bash $0" >&2
  exit 1
fi

DOMAIN="${DOMAIN:-YOUR_DOMAIN}"
if [[ "$DOMAIN" == "YOUR_DOMAIN" || -z "$DOMAIN" ]]; then
  echo "Állítsd be: DOMAIN=apex.example.com (nem live. prefix)" >&2
  exit 1
fi

KEY="${LIVEKIT_API_KEY:-}"
SECRET="${LIVEKIT_API_SECRET:-}"
if [[ -z "$KEY" || -z "$SECRET" ]]; then
  echo "Állítsd be LIVEKIT_API_KEY és LIVEKIT_API_SECRET (livekit-server generate-keys)." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC_YAML="$REPO_ROOT/deploy/livekit/livekit.yaml"
SRC_UNIT="$REPO_ROOT/deploy/livekit/livekit.service"
if [[ ! -x /usr/local/bin/livekit-server ]]; then
  curl -fsSL https://get.livekit.io | bash
fi
if [[ ! -x /usr/local/bin/livekit-server ]] && command -v livekit-server >/dev/null 2>&1; then
  install -m 0755 "$(command -v livekit-server)" /usr/local/bin/livekit-server
fi
if [[ ! -x /usr/local/bin/livekit-server ]]; then
  echo "livekit-server nincs /usr/local/bin alatt." >&2
  exit 1
fi

id livekit >/dev/null 2>&1 || useradd --system --home /var/lib/livekit --shell /usr/sbin/nologin livekit
mkdir -p /var/lib/livekit
chown livekit:livekit /var/lib/livekit
getent group ssl-cert >/dev/null 2>&1 && usermod -aG ssl-cert livekit || true

umask 077
sed \
  -e "s/YOUR_DOMAIN/${DOMAIN}/g" \
  -e "s/LIVEKIT_API_KEY_PLACEHOLDER/${KEY}/g" \
  -e "s/LIVEKIT_API_SECRET_PLACEHOLDER/${SECRET}/g" \
  "$SRC_YAML" > /etc/livekit.yaml
chown root:livekit /etc/livekit.yaml
chmod 640 /etc/livekit.yaml

install -m 0644 "$SRC_UNIT" /etc/systemd/system/livekit.service
systemctl daemon-reload
systemctl enable livekit
systemctl restart livekit
systemctl --no-pager --full status livekit || true

echo
echo "B1 kész. Nest:"
echo "  LIVE_VIDEO_BACKEND=livekit"
echo "  LIVEKIT_API_KEY=$KEY"
echo "  LIVEKIT_API_SECRET=<ugyanaz>"
echo "  LIVEKIT_PUBLIC_URL=wss://live.${DOMAIN}"
echo "B2: DNS A live.${DOMAIN} + certbot -d live.${DOMAIN} + nginx reload"
echo "B3: bash deploy/livekit/ufw-livekit.sh"
