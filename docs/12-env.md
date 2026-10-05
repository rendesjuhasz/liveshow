# 12. Környezeti változók

A backend a `backend/.env`-et tölti (`main.ts` → `dotenv` a backend gyökérhez képest). A fájl **gitignore**-olt. Sablon: `backend/.env.example`.

A frontend API címe böngészőben: same-origin `/api`. Szerver: `NEXT_PUBLIC_API_URL` vagy default `http://127.0.0.1:3200`.

**JWT / STREAM:** `JWT_SECRET` és `STREAM_SECRET` **minden környezetben kötelező**. Nincs `.jwt-dev-secret` és nincs kódbeli fallback. Hiány → a process nem indul.

---

## 12.1 Teljes lista

```env
# --- kötelező ---
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/streaming?schema=public

# --- HTTP ---
PORT=3200
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://127.0.0.1:3200

# --- auth (kötelező) ---
JWT_SECRET=
STREAM_SECRET=
ALLOW_DEV_PAY=true
BOOTSTRAP_ADMIN_EMAIL=admin@admin.com

# --- e-mail ---
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
ADMIN_EMAIL=
CONTACT_EMAIL=

# --- Stripe (ha ki van töltve, fizetős jegy ELŐSZÖR Stripe) ---
STRIPE_SECRET_KEY=

# --- LiveKit (B: élő videó SFU) ---
LIVE_VIDEO_BACKEND=livekit
LIVEKIT_SHOW_IDS=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_PUBLIC_URL=wss://live.YOUR_DOMAIN
LIVEKIT_URL=http://127.0.0.1:7880
LIVEKIT_TOKEN_TTL_SEC=3600

# --- Barion (csak ha BARION_ENABLED=true ÉS POS+payee, ÉS nincs Stripe secret) ---
BARION_ENABLED=false
BARION_POS_KEY=
BARION_PAYEE=
BARION_ENV=test

# --- backup (automatikus; default bekapcsolva) ---
BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=24
BACKUP_KEEP_DAYS=7
BACKUP_DIR=
BACKUP_STARTUP_DELAY_MS=15000
BACKUP_OFFSITE_ENABLED=true
BACKUP_OFFSITE_REQUIRED=
BACKUP_OFFSITE_KEEP_DAYS=14
BACKUP_S3_BUCKET=
BACKUP_S3_REGION=eu-central-1
BACKUP_S3_ACCESS_KEY=
BACKUP_S3_SECRET_KEY=
BACKUP_S3_PREFIX=liveshow
BACKUP_S3_ENDPOINT=
BACKUP_S3_FORCE_PATH_STYLE=

# --- monitoring / ops alerts ---
ADMIN_EMAIL=
ALERTS_ENABLED=true
ALERT_COOLDOWN_MINUTES=30
ALERT_SMTP_FAILS=5
HEALTH_DISK_MIN_FREE_MB=512
HEALTH_REQUIRE_SMTP=
HEALTH_POLL_MS=60000

# --- AI marketing kit ---
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
MARKETING_TOKEN_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
X_CLIENT_ID=
X_CLIENT_SECRET=

# --- AI Safety Alerts ---
ALERT_DISCORD_WEBHOOK=
ALERT_TELEGRAM_BOT_TOKEN=
ALERT_TELEGRAM_CHAT_ID=
```

---

## 12.2 Magyarázat

| Változó | Használja? | Hol | Mire |
|---------|------------|-----|------|
| `DATABASE_URL` | igen | Prisma, `backend/src/db/index.ts` (Drizzle legacy) | Postgres kapcsolat |
| `PORT` | igen | `main.ts` | API listen, default `3200`, host `0.0.0.0` |
| `FRONTEND_URL` | igen | mail sablonok, Stripe/Barion return URL | linkek, checkout success/fail (`/payment/success`, `/payment/failed`) |
| `BACKEND_URL` | Barion | `payments.service.ts` | webhook bázis (`/api/barion/webhook`) |
| `JWT_SECRET` | **igen mindig** | `auth/secrets.ts`, `jwt.strategy.ts` | User JWT. Hiány → nincs boot. Nincs `.jwt-dev-secret`. |
| `ALLOW_DEV_PAY` | nem | `payments.service.ts` | `true` kényszeríti a tesztfizetést; `false` tiltja. Default: nem production. |
| `BOOTSTRAP_ADMIN_EMAIL` | nem | `auth/roles.ts` | default `admin@admin.com` |
| `NEXT_PUBLIC_API_URL` | frontend **build** | `frontend/api/http.ts`, HLS URL | éles: `https://api.YOUR_DOMAIN` a `next build` előtt; default `http://127.0.0.1:3200` |
| `STREAM_SECRET` | igen | `token.service.ts` | HMAC a HLS `token` query-hez; default `dev-secret` |
| `SMTP_HOST` | igen | `mail.service.ts` | ha HOST+USER+PASS mind megvan → SMTP küldés |
| `SMTP_PORT` | igen | ugyanott | default `587` |
| `SMTP_SECURE` | igen | ugyanott | csak ha értéke a string `true` |
| `SMTP_USER` / `SMTP_PASS` | igen | SMTP auth | hiány → nincs kimenő levél, csak outbox + `EmailLog` `logged` |
| `MAIL_FROM` | igen | `from` header | default: `SMTP_USER` |
| `ADMIN_EMAIL` | igen | `contact.service.ts` | kapcsolatűrlap admin értesítés |
| `CONTACT_EMAIL` | fallback | ugyanott | ha nincs `ADMIN_EMAIL` |
| `STRIPE_SECRET_KEY` | igen | `payments.service.ts` | Checkout Session; **elsőbbség** a Barion előtt |
| `BARION_ENABLED` | igen | `barion.client.ts` | `true` / `1` / `yes` (kisbetű) |
| `BARION_POS_KEY` | igen | Barion Start / state | merchant POS Key |
| `BARION_PAYEE` | igen | fizetés | kedvezményezett e-mail / fiók |
| `BARION_ENV` | igen | API host | `test` (default) vagy `prod` / `production` |
| `BACKUP_ENABLED` | igen | `backup.service.ts` | `false` / `0` / `off` kikapcsolja. Default: be |
| `BACKUP_INTERVAL_HOURS` | igen | ugyanott | default `24` |
| `BACKUP_KEEP_DAYS` | igen | ugyanott | default `7` |
| `BACKUP_DIR` | igen | ugyanott | default `backend/backups` (app lemez — élesben **offsite** mount; lásd ops-inventory) |
| `BACKUP_STARTUP_DELAY_MS` | igen | ugyanott | első futás késleltetése, default `15000` |
| `BACKUP_OFFSITE_ENABLED` | igen | `offsite-s3.ts` | default be, ha van bucket+kulcs |
| `BACKUP_OFFSITE_REQUIRED` | igen | ugyanott | productionban default true — BackupRun elbukik offsite nélkül |
| `BACKUP_OFFSITE_KEEP_DAYS` | igen | ugyanott | remote megőrzés, default 14 |
| `BACKUP_S3_BUCKET` / `REGION` / `ACCESS_KEY` / `SECRET_KEY` | igen | ugyanott | AWS S3, B2 vagy Wasabi |
| `BACKUP_S3_ENDPOINT` | igen | ugyanott | B2/Wasabi URL; AWS-nél üres |
| `BACKUP_S3_PREFIX` | igen | ugyanott | default `liveshow` |
| `BACKUP_S3_FORCE_PATH_STYLE` | igen | ugyanott | endpoint esetén default true |
| `LIVE_VIDEO_BACKEND` | élő videó | `livekit-config.ts` | éles: `livekit`. Kulcs nélkül a config továbbra is mesh |
| `LIVEKIT_SHOW_IDS` | élő videó | ugyanott | üres = minden műsor a flag szerint |
| `LIVEKIT_API_KEY` / `SECRET` | élő videó | `livekit.service.ts` | ugyanaz, mint `/etc/livekit.yaml` `keys` |
| `LIVEKIT_PUBLIC_URL` | élő videó | token JSON `url` | `wss://live.YOUR_DOMAIN` |
| `LIVEKIT_URL` | belső | opcionális | `http://127.0.0.1:7880` |
| `LIVEKIT_TOKEN_TTL_SEC` | élő videó | token TTL | default 3600 |
| `ALERTS_ENABLED` | igen | `mail.service.ts` | ops riasztás, default be |
| `ALERT_COOLDOWN_MINUTES` | igen | mail / ops | default `30` |
| `ALERT_SMTP_FAILS` | igen | `mail.service.ts` | egymást követő SMTP hiba küszöb, default `5` |
| `HEALTH_DISK_MIN_FREE_MB` | igen | `ops.service.ts` | ready + disk riasztás, default `512` |
| `HEALTH_REQUIRE_SMTP` | igen | `ops.service.ts` | productionban default kötelező SMTP env |
| `HEALTH_POLL_MS` | igen | `ops.service.ts` | háttér health probe, default `60000` |
| `COST_STORAGE_GB_MONTH_FT` | igen | `cost.service.ts` | tárhely Ft/GB/hó; admin `/admin/costs` felülírja |
| `COST_CDN_MONTHLY_FT` | igen | ugyanott | CDN havi Ft (0 = nincs CDN) |
| `COST_TRANSCODE_HOUR_FT` | igen | ugyanott | FFmpeg óra Ft (0 = a VPS díjban) |
| `COST_SERVER_MONTHLY_FT` | igen | ugyanott | VPS havi számla |
| `COST_DB_MONTHLY_FT` | igen | ugyanott | managed Postgres, vagy 0 |
| `COST_EMAIL_PER_1000_FT` | igen | ugyanott | 1000 EmailLog / Ft |
| `COST_BUDGET_MONTHLY_FT` | igen | ugyanott | opcionális havi keret |

Nem env, de ismert azonosító:

| Hol | Érték |
|-----|--------|
| Bootstrap admin (default) | email `admin@admin.com` ha `BOOTSTRAP_ADMIN_EMAIL` üres; a Next UI is ezt hardcode-olja |
| CORS | production: `FRONTEND_URL` + mindig `localhost:3000` / `127.0.0.1:3000` |
| Stream HMAC fallback | nem production: `dev-secret` |

---

## 12.3 Fizetési döntési fa (env)

```
fizetős jegy
  ├─ STRIPE_SECRET_KEY kitöltve? → Stripe Checkout
  ├─ különben BARION_ENABLED + POS + payee? → Barion
  └─ különben → teszt (devPay / confirm-dev)
```

Ingyenes / 0 Ft jegy: nincs gateway.

---

## 12.4 Éles checklist

Teljes titok-audit és pipálható lista: [production-env-checklist.md](./production-env-checklist.md).

Röviden:

1. Erős, külön `JWT_SECRET` és `STREAM_SECRET` (`openssl rand -base64 48`).
2. `FRONTEND_URL` / `BACKEND_URL` HTTPS; frontend build: `NEXT_PUBLIC_API_URL`.
3. `BOOTSTRAP_ADMIN_EMAIL` ne a kódbeli `admin@admin.com` legyen élesben.
4. SMTP + `ADMIN_EMAIL`; `ALLOW_DEV_PAY` ne `true`.
5. Stripe live + webhook secret **vagy** Barion `BARION_ENV=prod` — ne teszt kulcs.
6. `BACKUP_S3_*` (productionban offsite kötelező).
7. Soha ne commitold a `.env`-et. `chmod 600`.
