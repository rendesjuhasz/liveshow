# 11. Infrastrukturális dokumentáció

**Jelenlegi állapot:** a repóban **nincs** éles VPS inventory, Nginx fájl, SSL tanúsítvány vagy backup script. A fejlesztés helyi gépen fut (`localhost:3000` + `127.0.0.1:3200`). Ez a dokumentum (1) a mai tényt rögzíti, (2) kitöltendő éles sablont ad, (3) ajánlott Nginx / backup / log elrendezést.

Élesítés után **ezt a fájlt kell aktualizálni** (IP, domain, SSH, PM2 nevek).

---

## 11.1 VPS / szerver adatok (kitöltendő)

| Mező | Érték | Megjegyzés |
|------|--------|------------|
| Szolgáltató | _pl. Hetzner / DigitalOcean / Contabo_ | |
| Hostname | | |
| Nyilvános IPv4 | | UDP ingest (RTP) ide megy, nem az Nginx HTTP-n |
| IPv6 | | |
| OS | ajánlott Ubuntu 22.04/24.04 LTS | FFmpeg + Node 20 |
| vCPU / RAM / disk | élő HLS-hez min. 2 vCPU, 4 GB RAM, SSD | szegmensek + archív MP4 |
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

Ajánlott: **Nginx** + **Let's Encrypt** (`certbot --nginx`).

- HTTP 80 → redirect 443
- TLS 1.2+
- `client_max_body_size` avatarhoz legalább `8m`
- WebSocket: Socket.IO a Nest porton (`Upgrade` headerek) — ha a UI az API hostot hívja WS-re
- HLS: **ne** cache-eld agresszívan a `index.m3u8`-at (`Cache-Control` a backend már `no-store`)

UDP RTP **nem** megy HTTP reverse proxyn. Az encoder a VPS `:rtpPort` UDP-jére küld.

---

## 11.4 Nginx példa

```nginx
# /etc/nginx/sites-available/liveshow
# Cseréld: pelda.hu, api.pelda.hu

upstream liveshow_web {
    server 127.0.0.1:3000;
    keepalive 8;
}

upstream liveshow_api {
    server 127.0.0.1:3200;
    keepalive 8;
}

server {
    listen 80;
    server_name pelda.hu www.pelda.hu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pelda.hu www.pelda.hu;

    ssl_certificate     /etc/letsencrypt/live/pelda.hu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pelda.hu/privkey.pem;

    client_max_body_size 8m;

    location / {
        proxy_pass http://liveshow_web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name api.pelda.hu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.pelda.hu;

    ssl_certificate     /etc/letsencrypt/live/api.pelda.hu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.pelda.hu/privkey.pem;

    client_max_body_size 8m;

    # HLS playlist: ne cache
    location ~* /output/.+/index\.m3u8$ {
        proxy_pass http://liveshow_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location / {
        proxy_pass http://liveshow_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
```

Certbot a `ssl_certificate` sorokat felülírhatja. `nginx -t && systemctl reload nginx`.

---

## 11.5 Backup stratégia

Nincs automatikus backup a kódban. Minimum élesben:

| Mit | Gyakoriság | Hol |
|-----|------------|-----|
| PostgreSQL `pg_dump -Fc` | naponta + a kifizetés/jegy hétvégén extra | offsite (S3 / másik gép) |
| `backend/output/` (HLS + `archive.mp4`) | archív után azonnal; élő szegmens opcionális | object storage — **nagy** |
| `backend/uploads/` (avatar) | naponta | ugyanaz |
| `backend/.env` | titkosított másolat, **nem** git | password manager |
| Prisma migrációk | git | a kód a forrás |

Visszaállítás sorrend: Postgres dump → `prisma migrate deploy` (ha a dump régi séma) → fájlok (`output`, `uploads`) → PM2 restart. Teszteld a restore-t évente egyszer.

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
