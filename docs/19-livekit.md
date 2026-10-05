# LiveKit telepítés (B1–B5)

Apex host: `YOUR_DOMAIN` (pl. `liveshow.hu`). SFU host: `live.YOUR_DOMAIN`.

## B1 — livekit-server

```bash
sudo livekit-server generate-keys
cd /var/www/liveshow
sudo DOMAIN=YOUR_DOMAIN \
  LIVEKIT_API_KEY='...' \
  LIVEKIT_API_SECRET='...' \
  bash deploy/livekit/install.sh
sudo systemctl status livekit
curl -sS http://127.0.0.1:7880
```

Fájlok: `deploy/livekit/livekit.yaml` → `/etc/livekit.yaml`, `deploy/livekit/livekit.service`.

## B2 — DNS + TLS + WSS

1. A rekord: `live.YOUR_DOMAIN` → média IPv4.
2. Certbot (ugyanaz a cert mappa, extra `-d`):

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d YOUR_DOMAIN -d www.YOUR_DOMAIN -d api.YOUR_DOMAIN -d live.YOUR_DOMAIN
```

3. `deploy/nginx/liveshow.conf` (YOUR_DOMAIN csere) → nginx, `nginx -t && systemctl reload nginx`.
4. Nest: `LIVEKIT_PUBLIC_URL=wss://live.YOUR_DOMAIN`.

## B3 — tűzfal

```bash
sudo bash deploy/livekit/ufw-livekit.sh
```

Nyitva: 80/443 TCP, 50000–50050 UDP, 3478 UDP, 5349 TCP. **7880, 3000, 3200 zárva** kifelé.

## B4 — TURN

A yaml-ben `turn.enabled: true`, domain `live.YOUR_DOMAIN`, cert a Let's Encrypt fájlok. A `livekit` user `ssl-cert` csoportban (install.sh). Mobil 4G próba: publisher Wi‑Fi, néző LTE.

TURN nélkül csak azonos NAT/LAN lehet életképes.

## B5 — Nest

`backend/.env`:

```
LIVE_VIDEO_BACKEND=livekit
LIVEKIT_SHOW_IDS=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_PUBLIC_URL=wss://live.YOUR_DOMAIN
LIVEKIT_URL=http://127.0.0.1:7880
```

PM2 restart `liveshow-api`. `GET /livekit/config?showId=<uuid>` → `"backend":"livekit"` csak ha a kulcsok megvannak.

Üres allowlist + `livekit` = minden `purpose=live` SFU. Mesh rollback: `LIVE_VIDEO_BACKEND=mesh`.

## B6 — token refresh

A JWT TTL 80%-ánál (min. 15 s) a publisher és a néző új tokent kér, reconnect + republish. A kód VPS nélkül is bent van.

## B7 — preflight

`GET /streamer/preflight/ingest` tartalmazza a LiveKit health-t. Ha `LIVE_VIDEO_BACKEND=livekit`, az ingest csak akkor `ok`, ha a LiveKit HTTP probe is sikerül. A streamer preflight a `/health/livekit` és `/livekit/config` végpontokat is pingeli.

## B8 — health

`GET /health/livekit` és `GET /health/ready` `checks.livekit`. Kulcs nélkül `skip`; `LIVE_VIDEO_BACKEND=livekit` mellett kötelező (`error` → 503). Probe: `LIVEKIT_URL` (http), alap `http://127.0.0.1:7880`.

## B9 — publisher

Simulcast: 720p + h360/h180 rétegek, VP8. Tab váltáskor (`visibilitychange`) a kamera stream megmarad, reconnect ha a room nem Connected.

## B10 — néző

Stall / disconnect után max 5 újrapróbálkozás. Autoplay muted; „Hang bekapcsolása” gomb.

## B11 — API tesztek

`livekit.service.spec.ts`, `livekit-config.spec.ts` (TTL 80%, HTTP probe URL).

