# Monitoring and alerting

LiveShow operator monitoring: Nest health probes, admin email alerts, backup history, stream metrics, PM2, and external uptime checks.

## Architecture

```
Uptime Kuma / Better Stack / UptimeRobot
        │
        ▼
 GET /health/uptime  (200 = ready, 503 = not ready)
        │
 Nest OpsService ── probes Postgres, FFmpeg, disk, uploads, SMTP config
        │
 MailService.opsAlert ── ADMIN_EMAIL (EmailLog type ops_alert, outbox + SMTP)
        │
 Admin UI  /admin/monitoring  +  /admin/backups  +  /admin/emails
```

Audience notifications (ticket mail, live reminder, follow) are separate. Ops alerts use `ADMIN_EMAIL` (fallback `CONTACT_EMAIL`).

## Health endpoints

Base: `http://127.0.0.1:3200` (or the public API host). No JWT.

| Method | Path | Meaning | Success |
|--------|------|---------|---------|
| GET | `/` | Process liveness | 200 `{ status: "ok", service, uptimeSec }` |
| GET | `/health` | Same as live | 200 |
| GET | `/health/live` | Nest process is running | always 200 while the process answers |
| GET | `/health/ready` | Dependencies | 200 if all required checks pass, **503** otherwise |
| GET | `/health/uptime` | Dedicated uptime probe | 200 `{ status: "ok" }` or 503 `{ status: "error" }` |

Ready JSON (required fields plus details):

```json
{
  "status": "ok",
  "db": "ok",
  "ffmpeg": "ok",
  "disk": "ok",
  "smtp": "ok",
  "storage": "ok",
  "checks": {
    "db": { "status": "ok", "latencyMs": 4 },
    "ffmpeg": { "status": "ok", "detail": "ffmpeg version ..." },
    "storage": { "status": "ok" },
    "disk": { "status": "ok", "freeBytes": 12000000000, "thresholdBytes": 536870912 },
    "smtp": { "status": "ok" }
  }
}
```

Checks:

- **db** — `SELECT 1`
- **ffmpeg** — `ffmpeg -version`
- **storage** — writable `backend/uploads` and `backend/output`
- **disk** — free bytes ≥ `HEALTH_DISK_MIN_FREE_MB` (default 512)
- **smtp** — `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS`. Required in production unless `HEALTH_REQUIRE_SMTP=false`. In development missing SMTP is `skip` and does not fail ready.

Point load balancers at `/health/live` (restart-friendly) and uptime monitors at `/health/uptime` or `/health/ready`.

## Alert rules

Alerts go to `ADMIN_EMAIL` via `MailService` (`ops_alert`). Cooldown: `ALERT_COOLDOWN_MINUTES` (default 30). Disable with `ALERTS_ENABLED=false`.

Each alert includes timestamp, `NODE_ENV`, service, kind, message, and optional show/stream/detail.

| Kind | Trigger |
|------|---------|
| `ingest_fail` | FFmpeg ingest error / ingest aborted |
| `stream_start` | Streamer dashboard failed to start ingest |
| `archive_fail` | Archive FFmpeg failed (not “no recording”) |
| `backup_fail` | Backup snapshot not fully ok |
| `smtp_fail` | Consecutive SMTP send failures ≥ `ALERT_SMTP_FAILS` (default 5). Includes recipient and provider error |
| `db_down` | Ready probe cannot reach Postgres |
| `disk_low` | Free space below threshold |

Events are stored in `OpsEvent` and listed on `/admin/monitoring`. Emails appear on `/admin/emails`.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ADMIN_EMAIL` | — | Ops alert recipient (fallback `CONTACT_EMAIL`) |
| `ALERTS_ENABLED` | `true` | Set `false` to suppress ops mail |
| `ALERT_COOLDOWN_MINUTES` | `30` | Deduplicate same kind |
| `ALERT_SMTP_FAILS` | `5` | Consecutive SMTP failures before alert |
| `HEALTH_DISK_MIN_FREE_MB` | `512` | Ready + disk_low |
| `HEALTH_REQUIRE_SMTP` | production=`true` | Fail ready if SMTP env missing |
| `HEALTH_POLL_MS` | `60000` | Background probe interval (min 15000) |
| `BACKUP_*` | see docs/12-env.md | Backup schedule and directory |
| `SMTP_*` | — | Outgoing mail |

## PM2

From the repository root, after `backend` `npm run build` and `frontend` `npm run build`:

```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
pm2 logs liveshow-api
```

The file `ecosystem.config.js` defines:

- names: `liveshow-api`, `liveshow-web`
- **one** API instance (`fork`) — ingest is not cluster-safe
- `autorestart`, `max_restarts`, `min_uptime`, `restart_delay`
- API `max_memory_restart: 1024M`; web `512M`
- logs: `logs/api-out.log`, `logs/api-error.log`, web equivalents, with timestamps

Install log rotation: `pm2 install pm2-logrotate`. Keep `cwd` as in the config (`./backend`, `./frontend`). Load secrets from `backend/.env` (Nest `dotenv`), not from git.

## Uptime monitoring setup (required before public launch)

Ops email uses SMTP. If mail is down, **only** an external HTTP monitor still pages you. Do not treat `ADMIN_EMAIL` as sufficient.

Use **GET** `https://<api-host>/health/uptime`. Expect HTTP **200**. Treat **503** as down (Postgres, FFmpeg, disk, storage, or — in production — missing SMTP). Keyword (optional): `"ok"`. Interval: 60s. Timeout: 10s.

Also monitor the public site `https://<www-host>/` (Next.js). Do **not** use `/health/live` alone for “can we serve traffic” — that stays 200 if Postgres is down.

Record both monitor URLs in [docs/ops-inventory.md](docs/ops-inventory.md).

Launch checklist:

- [ ] Monitor 1: `GET /health/uptime` → alert on non-200
- [ ] Monitor 2: public homepage → alert on non-200
- [ ] Notifications go to a channel that is **not** only this app’s SMTP (UptimeRobot email, Telegram, Better Stack, etc.)
- [ ] Confirm a forced 503 (stop Postgres briefly on staging) fires the monitor

### Uptime Kuma

1. New monitor → HTTP(s)
2. URL: `https://api.example.com/health/uptime`
3. Heartbeat: 60s
4. Accepted status codes: 200
5. Notification: email/Telegram as you prefer (this is independent of `ADMIN_EMAIL`)

### Better Stack (Uptime)

1. Create monitor → HTTP
2. URL: `https://api.example.com/health/uptime`
3. Check interval: 30s or 1m
4. Follow redirects: on
5. Recovery: HTTP 200 again

### UptimeRobot

1. Add new monitor → HTTP(s)
2. URL: `https://api.example.com/health/uptime`
3. Monitoring interval: 5 minutes (free) or 1 minute
4. Alert when down (non-200)
5. Optional keyword `ok` in JSON body

Also monitor the public site `https://www.example.com/` separately (Next.js). Do not use `/health/live` alone for “can we serve traffic” — that stays 200 if Postgres is down.

## Admin UI

- `/admin/monitoring` — health, streams (active, failures 24h, uptime), backup last success, SMTP streak, OpsEvent list
- `/admin/backups` — last verified success, `dbMethod`, BackupRun history, snapshots, verify button, same-volume warning
- `/admin/costs` — storage / CDN / transcode / server / DB / email vs platform commission
- `/admin/emails` — includes `ops_alert`

## Operational recovery checklist

1. **API down** — `pm2 status`, `pm2 logs liveshow-api --lines 80`, `pm2 restart liveshow-api`
2. **Ready 503 db** — Postgres running? `DATABASE_URL`? `pg_isready`
3. **Ready 503 ffmpeg** — `ffmpeg -version` on PATH as the PM2 user
4. **Ready 503 disk/storage** — free space on the volume that holds `backend/output` and `backend/uploads`; prune old HLS/archives
5. **Ready 503 smtp (production)** — set `SMTP_HOST/USER/PASS` or `HEALTH_REQUIRE_SMTP=false` only if you accept no mail
6. **Ingest alerts** — RTP port, FFmpeg, OBS to the VPS UDP port; see docs/13-streaming.md
7. **Backup fail** — `pg_dump`; `BACKUP_DIR`; `/admin/backups`; `verify.json`; offsite HeadObject ([docs/backup-offsite.md](docs/backup-offsite.md))
8. **SMTP streak** — provider credentials, TLS/`SMTP_SECURE`, `/admin/emails` status `failed`
9. **Restore** — [docs/restore-test.md](docs/restore-test.md) on a spare DB; snapshot `RESTORE.txt`

Related: [docs/11-infra.md](docs/11-infra.md), [docs/ops-inventory.md](docs/ops-inventory.md), [docs/12-env.md](docs/12-env.md), [docs/14-deploy.md](docs/14-deploy.md), [LAUNCH_READINESS.md](LAUNCH_READINESS.md).
