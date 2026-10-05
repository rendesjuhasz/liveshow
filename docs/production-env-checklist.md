# Production secrets and environment checklist

Audit date: 2026-09-08. Source of truth: Nest `backend/src` + Next `frontend/` as of this date. **Do not paste real secrets into git.** Generate values with:

```bash
openssl rand -base64 48
```

Use a password manager. VPS `backend/.env` mode `600`. PM2 does not inject JWT; Nest loads dotenv from `backend/.env`.

Stale docs (`secret123` hardcoded JWT, “JWT_SECRET not wired”) no longer match `auth/secrets.ts`. This file does.

---

## 1. Default secrets (known strings in code)

| Secret / identity | Default | Production risk | Code |
|-------------------|---------|-----------------|------|
| Stream HMAC | `dev-secret` if `STREAM_SECRET` empty **and** not production | Anyone who cloned the repo can mint HLS tokens in dev; if you ship without `STREAM_SECRET` in production, HMAC is empty and tokens **do not validate** (players fail — fail-closed, not fail-open) | `token.service.ts` `hmacSecret()` |
| Bootstrap admin email | `admin@admin.com` | Anyone who registers that address (or already has it) is treated as **admin** on API **and** in the Next UI | `auth/roles.ts`, `frontend/lib/roles.ts` (UI does **not** read env) |
| JWT in development | file `backend/.jwt-dev-secret` (gitignored) or created on first boot | Fine for laptop. **Must not** exist as the production secret; production **throws** if `JWT_SECRET` missing | `secrets.ts` `jwtSecret()` |
| Docs / comments | `secret123` still mentioned in old pages | Misleading; not used by current JWT path | `docs/12-env.md` §12.2 leftover, `docs/README.md` |

**Required action:** set `JWT_SECRET`, `STREAM_SECRET`, `BOOTSTRAP_ADMIN_EMAIL` (a mailbox you control). Change the bootstrap address **before** a public register. Frontend still hardcodes `admin@admin.com` for UI admin links — keep that user as admin in DB **or** treat the hardcoded UI check as a leftover risk until the frontend reads the same env (it cannot: Next public bundle). Operational fix: do not leave `admin@admin.com` as a real account; use `role=admin` in Postgres for your operator.

---

## 2. Weak secrets (too short, guessable, or environment-wrong)

| Item | Why weak | Production rule |
|------|----------|-----------------|
| `JWT_SECRET` shorter than ~32 random bytes | Brute / reuse | ≥ 48 bytes base64 from `openssl rand` |
| `STREAM_SECRET` = `dev-secret` or `secret` or domain name | In repo / guessable | Independent of JWT; ≥ 32 bytes random |
| `DATABASE_URL` password `postgres` / empty | Default Postgres | Unique password; no `trust` auth from the internet |
| Stripe `sk_test_…` with `NODE_ENV=production` | Test money / no real charges or leaked test/live mix | Live: `sk_live_…` only on the VPS |
| `BARION_ENV=test` (code default) while selling tickets | Payments hit Barion **test** | `BARION_ENV=prod` with live POS key |
| `ALLOW_DEV_PAY=true` | `POST /payments/confirm-dev` activates packs without a gateway | Must be unset or `false` in production (`isDevPayAllowed()` is already false when `NODE_ENV=production` unless this flag is true) |
| Reusing one string for JWT + STREAM + SMTP | Blast radius | Three independent secrets |
| `NEXT_PUBLIC_API_URL=http://127.0.0.1:3200` baked into `next build` | HLS URLs leak localhost | `https://api.YOUR_DOMAIN` at **build** time |

---

## 3. Missing secrets (production will be wrong or refuse to boot)

| Variable | If missing | Severity |
|----------|------------|----------|
| `JWT_SECRET` | Process **does not start** (`NODE_ENV=production`) | Blocker |
| `STREAM_SECRET` | Stream tokens empty; live/archive URLs fail HMAC | Blocker for watch |
| `DATABASE_URL` | Prisma cannot connect; `/health/ready` 503 | Blocker |
| `FRONTEND_URL` | CORS may omit the real origin; mail/reset/Stripe return URLs stay `http://127.0.0.1:3000` | Blocker for browser + mail |
| `BACKEND_URL` | Barion/Stripe webhooks point at localhost | Blocker if using those gateways |
| `NEXT_PUBLIC_API_URL` | Player uses `http://127.0.0.1:3200/output/…` | Blocker for HLS |
| `SMTP_HOST` + `USER` + `PASS` | No inbox mail; ready probe fails SMTP in production (`HEALTH_REQUIRE_SMTP` default true) | Blocker for mail + ready |
| `ADMIN_EMAIL` | Ops alerts log a warning and skip send | High (blind ops) |
| `BACKUP_S3_*` | Offsite skipped; in production `BACKUP_OFFSITE_REQUIRED` defaults **true** → backup runs **fail** | Blocker for DR |
| `STRIPE_SECRET_KEY` | No Stripe; falls through to Barion or **dev pay** | Blocker if you sell via Stripe |
| `STRIPE_WEBHOOK_SECRET` | `POST /payments/stripe/webhook` throws if called | Blocker if Stripe webhooks enabled |
| `BARION_POS_KEY` + `BARION_PAYEE` | Barion disabled even if `BARION_ENABLED` | Blocker if Barion is the gateway |
| `BOOTSTRAP_ADMIN_EMAIL` | Falls back to `admin@admin.com` | High |
| `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` + `LIVEKIT_PUBLIC_URL` | Token 503 / mesh fallback; élő SFU nincs | Blocker for LiveKit live |
| `LIVE_VIDEO_BACKEND=livekit` | Ha mesh marad, a Player P2P-t használ | High for B cutover |

There is **no** `COOKIE_SECRET` / `NEXTAUTH_SECRET`. Refresh + CSRF cookies are opaque tokens, not HMAC’d with a dedicated env key.

---

## 4. Insecure defaults (not always “secrets”)

| Default | Code | Production setting |
|---------|------|-------------------|
| API listen `0.0.0.0:3200` | `main.ts` | Firewall: only localhost; Nginx on 443 |
| CORS includes `http://localhost:3000` even in production | `corsOrigins()` always unions localhost | Prefer `FRONTEND_URL=https://apex,https://www` only; localhost in prod CORS is extra attack surface if 3200 is reachable |
| `BARION_ENV` → `test` | `barion.client.ts` | `prod` |
| `SMTP_SECURE` → not TLS-wrapper | only string `true` enables it | Port 587: leave false (STARTTLS). Port 465: `true` |
| `BACKUP_DIR` → `backend/backups` on app disk | `backup.service.ts` | Second disk **and** `BACKUP_S3_*` |
| `HEALTH_DISK_MIN_FREE_MB` → 512 | small for HLS | Raise (e.g. 4096+) |
| `TRUST_PROXY` true when `NODE_ENV=production` | rate-limit client IP from `X-Forwarded-For` | Safe **only** if Nginx is the only peer; never publish 3200 |
| `confirm-dev` route still exists | rejected unless `ALLOW_DEV_PAY` | Keep `NODE_ENV=production`, never set the flag |
| Frontend `isAdmin` + `admin@admin.com` | `frontend/lib/roles.ts` | Operator account must not rely on that email; set DB `role=admin` |
| Snapshot `config/backend.env` | plaintext copy of `.env` | Offsite bucket private; treat dump as secret |
| Next CSP `connect-src` includes `http://127.0.0.1:3200` | `next.config.ts` | Harmless extra; HLS must still use HTTPS API host |
| Password min length 8 | `rate-limit.ts` | Policy OK for launch; no complexity rules |

---

## 5. Production-ready environment checklist

Copy to the VPS. Check a box only after the value is set **and** verified (curl / login / one test mail).

### 5.1 Process and URLs

- [ ] `NODE_ENV=production` (PM2 `ecosystem.config.js` already sets this for both apps)
- [ ] `PORT=3200` (API); web `3000` — neither published on the internet
- [ ] `FRONTEND_URL=https://YOUR_DOMAIN` (add `,https://www.YOUR_DOMAIN` if both are used)
- [ ] `BACKEND_URL=https://api.YOUR_DOMAIN`
- [ ] Frontend **rebuild** with `NEXT_PUBLIC_API_URL=https://api.YOUR_DOMAIN`
- [ ] Optional: `NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN` (SEO canonical)
- [ ] `TRUST_PROXY` left default (production) **and** UFW denies 3200/3000

### 5.2 Auth and stream tokens

- [ ] `JWT_SECRET` = `openssl rand -base64 48` (unique, not in git, not `secret123`)
- [ ] `STREAM_SECRET` = different `openssl rand -base64 32` (not `dev-secret`)
- [ ] `BOOTSTRAP_ADMIN_EMAIL` = your real admin mailbox (not `admin@admin.com` if that inbox is public)
- [ ] After JWT rotation: all users must log in again
- [ ] `ALLOW_DEV_PAY` unset or `false`
- [ ] Confirm `POST /payments/confirm-dev` returns an error while logged in as a normal user

### 5.3 Database

- [ ] `DATABASE_URL` user/password not default `postgres`/`postgres`
- [ ] Database not reachable from `0.0.0.0:5432` (localhost or private network / SSL for managed PG)
- [ ] `npx prisma migrate deploy` against this URL only on the VPS

### 5.4 Mail and ops

- [ ] `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- [ ] `SMTP_PORT` / `SMTP_SECURE` match the provider
- [ ] `ADMIN_EMAIL` (ops + contact fallback)
- [ ] `GET /health/ready` → `smtp: ok`
- [ ] One test `ops_alert` or contact form reaches the inbox
- [ ] `HEALTH_REQUIRE_SMTP` not set to `false` unless you accept no mail

### 5.5 Payments (if selling tickets)

- [ ] Exactly one live gateway: Stripe **or** Barion (Stripe wins if both set)
- [ ] Stripe: `STRIPE_SECRET_KEY=sk_live_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`, webhook URL `https://api.YOUR_DOMAIN/payments/stripe/webhook`
- [ ] Barion: `BARION_ENABLED=true`, live `BARION_POS_KEY`, `BARION_PAYEE`, **`BARION_ENV=prod`**, `BACKEND_URL` for IPN
- [ ] No `sk_test_` / Barion test POS on this host

### 5.6 Backups and DR

- [ ] `BACKUP_ENABLED` not `false`
- [ ] `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`, region/endpoint per [backup-offsite.md](backup-offsite.md)
- [ ] `BACKUP_OFFSITE_REQUIRED` true (production default)
- [ ] `/admin/backups` last run: verified `pg_dump` **and** offsite OK
- [ ] Restore drill logged ([restore-test.md](restore-test.md))

### 5.7 Host file hygiene

- [ ] `chmod 600 backend/.env`; owner = PM2 user
- [ ] `.env` not in git (`git check-ignore -v backend/.env`)
- [ ] No `backend/.jwt-dev-secret` on the VPS (dev-only)
- [ ] Let’s Encrypt + Nginx per [ssl-setup.md](ssl-setup.md)

### 5.8 Copy-paste template (empty values)

```env
NODE_ENV=production
PORT=3200
DATABASE_URL=postgresql://USER:STRONG_PASSWORD@127.0.0.1:5432/liveshow?schema=public
FRONTEND_URL=https://YOUR_DOMAIN
BACKEND_URL=https://api.YOUR_DOMAIN
JWT_SECRET=
STREAM_SECRET=
BOOTSTRAP_ADMIN_EMAIL=
ALLOW_DEV_PAY=false
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
ADMIN_EMAIL=
CONTACT_EMAIL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
BARION_ENABLED=false
BARION_POS_KEY=
BARION_PAYEE=
BARION_ENV=prod
BACKUP_ENABLED=true
BACKUP_OFFSITE_REQUIRED=true
BACKUP_S3_BUCKET=
BACKUP_S3_REGION=
BACKUP_S3_ACCESS_KEY=
BACKUP_S3_SECRET_KEY=
BACKUP_S3_PREFIX=liveshow
BACKUP_S3_ENDPOINT=
HEALTH_REQUIRE_SMTP=true
```

Frontend build (not in `backend/.env`):

```bash
cd frontend
NEXT_PUBLIC_API_URL=https://api.YOUR_DOMAIN npm run build
```

---

## 6. Quick fail tests

| Test | Expected |
|------|----------|
| Start API without `JWT_SECRET` and `NODE_ENV=production` | Process throws, no listen |
| `STREAM_SECRET` empty in production | HLS token generate/validate fails closed |
| `ALLOW_DEV_PAY=true` | **Do not ship**; confirm-dev would succeed |
| Ready probe | 200, `db`/`ffmpeg`/`smtp`/`storage`/`disk` ok |
| Browser login from `https://YOUR_DOMAIN` | CORS + cookies work; not mixed content |

Related: [12-env.md](./12-env.md), [15-security.md](./15-security.md), [ssl-setup.md](./ssl-setup.md), [backup-offsite.md](./backup-offsite.md).
