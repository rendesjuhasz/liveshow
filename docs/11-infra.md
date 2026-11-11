# 11. Infrastrukturális dokumentáció

**Jelenlegi állapot:** nincs kitöltött éles inventory, nincs Let's Encrypt tanúsítvány a gitben. Nginx sablon: [deploy/nginx/](../deploy/nginx/). Fejlesztés: `localhost:3000` + `127.0.0.1:3200`. Élesítés után töltsd ki [ops-inventory.md](./ops-inventory.md) (IP, domain, SSH).

Élesítés után **ezt a fájlt kell aktualizálni** (IP, domain, SSH, PM2 nevek).

---

Éles inventory sablon (DNS, SSL, `BACKUP_DIR`, uptime URL-ek, `ADMIN_EMAIL`): [ops-inventory.md](./ops-inventory.md). Töltsd ki azt a fájlt, vagy az alábbit — üres mező = nem launch-ready.

## 11.1 VPS / szerver adatok (kitöltendő)

| Mező | Érték | Megjegyzés |
|------|--------|------------|
| Szolgáltató | _pl. Hetzner / DigitalOcean / Contabo_ | |
| Hostname | | |
| Nyilvános IPv4 | | UDP ingest (RTP) ide megy, nem az Nginx HTTP-n |
| IPv6 | | |
| OS | ajánlott Ubuntu 22.04/24.04 LTS | FFmpeg + Node 20 |
| vCPU / RAM / disk | élő HLS-hez min. 2 vCPU, 4 GB RAM, SSD | P0 után ~45–60 néző / 2 vCPU; lásd [scalability-p0.md](./scalability-p0.md) |
| SSH user | | kulcsos belépés, ne root jelszó |
| App könyvtár | `_/var/www/liveshow_` | `git pull` ide |
| Node process | PM2: `liveshow-api`, `liveshow-web` | lásd [14-deploy.md](./14-deploy.md) |
| PostgreSQL | ugyanazon a VPS-en **vagy** managed | `DATABASE_URL` |
| FFmpeg | `ffmpeg -version` a PATH-on | ingest + archív |

**Tűzfal (ajánlott):**

| Port | Protokoll | Ki |
|------|-----------|-----|
| 22 | TCP | csak admin IP / VPN |
| 80, 443 | TCP | világ (HTTP→HTTPS, app) |
| 3200 | TCP | **ne** publikus; csak localhost, Nginx proxyzza |
| 3000 | TCP | **ne** publikus; ugyanígy |
| 5004 (vagy a műsor `rtpPort`) | UDP | encoder IP allowlist, ha lehet |

Az ingest a Node `dgram` socketet `0.0.0.0`-ra bindolja. Nyitott UDP = nyilvános belépési pont.

---

## 11.2 Domain felépítés (ajánlott)

A kód ma **egy origin**-t vár a CORS-ban (`localhost:3000`). Élesen két host a tiszta modell:

| Host | Cél | Proxy cél |
|------|-----|-----------|
| `www.pelda.hu` / `pelda.hu` | Next.js UI | `127.0.0.1:3000` |
| `api.pelda.hu` | NestJS | `127.0.0.1:3200` |

Alternatíva egy domain: `pelda.hu` → Next, `pelda.hu/api` **nem** illeszkedik a backendhez (nincs globális `/api` prefix). Maradj **külön API hostnál**, vagy Nginx-szel útvonalanként proxizz (`/shows`, `/auth`, `/output` …) — ez törékeny.

Beállítandó a kódban / env-ben élesítéskor:

- `FRONTEND_URL=https://pelda.hu`
- `BACKEND_URL=https://api.pelda.hu` (Barion webhook)
- CORS origin lista (`main.ts`)
- `frontend/api/http.ts` `API_URL`

DNS: A rekord a VPS IP-re. Barion / Stripe return URL-ek HTTPS-re.

---

## 11.3 Reverse proxy és SSL

Éles fájlok (egy VPS):

- Nginx: [deploy/nginx/liveshow.conf](../deploy/nginx/liveshow.conf) + bootstrap [liveshow-http-bootstrap.conf](../deploy/nginx/liveshow-http-bootstrap.conf)
- Lépések, Certbot, megújítás: [ssl-setup.md](./ssl-setup.md)

Röviden:

- HTTP 80 → ACME + redirect 443
- TLS 1.2 / 1.3; egy cert: apex + `www` + `api`
- `client_max_body_size 2048m` (VOD `vod-multer` 2 GB; a www host `/api` az nginxen a Nestre megy, nem a Next rewrite-on)
- HLS `/output/`: `proxy_buffering off`; `index.m3u8` no-store
- WebSocket: `Upgrade` / `$connection_upgrade` az API hoston
- UDP RTP **nem** megy Nginxen

---

## 11.4 Nginx + Certbot

Ne másold ide a konfigot. Használd a `deploy/nginx/` fájlokat és a [ssl-setup.md](./ssl-setup.md) parancsokat (`sed YOUR_DOMAIN`, `certbot certonly --webroot`, deploy hook `reload nginx`).

---

## 11.5 Backup stratégia

A backend indulás után automatikusan ment (alapból 15 mp, majd 24 óránként) a `backend/backups/` mappába (gitignore). Admin felület: `/admin/backups`.

| Mit | Hol a snapshotban |
|-----|-------------------|
| PostgreSQL | `database/postgres.dump` (`pg_dump`), vagy táblánkénti `database/*.json` ha nincs `pg_dump` |
| Média | `media/uploads`, `media/output` (archív / felvétel; élő `.ts` nélkül) |
| Konfig | `config/backend.env`, `schema.prisma`, `platform-config.json`, `runtime-env.json` |

Env: `BACKUP_ENABLED` (default true), `BACKUP_INTERVAL_HOURS` (24), `BACKUP_KEEP_DAYS` (7), `BACKUP_DIR`, `BACKUP_STARTUP_DELAY_MS`.

Élesben a `BACKUP_DIR` legyen külön lemez **és** S3-kompatibilis offsite ([backup-offsite.md](./backup-offsite.md): AWS / Backblaze B2 / Wasabi). Fájlellenőrzés: `verify.json`; feltöltés után HeadObject méret. Admin: `/admin/backups`.

`hls_flags delete_segments`: az élő ablak **rövid**; az archívum **csak** ha lefutott a generate (recording vagy playlist → `archive.mp4`). Ne hidd, hogy a HLS mappa = teljes adás.

---

## 11.6 Logok helye

| Forrás | Hol |
|--------|-----|
| Nest `console.log` / FFmpeg stderr | a folyamat stdout-ja. PM2: `~/.pm2/logs/liveshow-api-out.log`, `*-error.log` |
| `npm` / Nest | `backend/*.log` gitignore-olva, ha keletkezik |
| Email outbox (SMTP nélkül) | `backend/mail-outbox/*.html` (gitignore) |
| Email napló DB | `EmailLog` tábla, admin `/admin/emails` |
| Nginx access/error | `/var/log/nginx/access.log`, `error.log` |
| PostgreSQL | distro szerint `/var/log/postgresql/` |
| HLS / ingest | nincs külön logfile; FFmpeg a Nest stdout-ra ír: `FFmpeg ingest: …` |

PM2: `pm2 logs liveshow-api`. Forgatás: `pm2 install pm2-logrotate` vagy logrotate.

---

## 11.7 Lemez layout (ajánlott)

```
/var/www/liveshow/
  backend/          # git, cwd a Nestnek → output/, uploads/, mail-outbox ide kerül
  frontend/
/var/backups/liveshow/
```

A HLS gyökér **`process.cwd()/output`**, nem a `src` mappa. PM2 `cwd` legyen a `backend/` könyvtár, különben az ingest máshova ír.

Kapcsolódó: [13-streaming.md](./13-streaming.md), [14-deploy.md](./14-deploy.md), [15-security.md](./15-security.md).
