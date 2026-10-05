# Disaster Recovery

This plan matches the **LiveShow repo as implemented**, not a generic cloud DR template.

**What actually runs today**

- One NestJS API (`PORT` default 3200) + one Next.js UI (3000). No Docker, no Kubernetes, no Redis, no HLS CDN, no RTMP server (`node-media-server` is unused).
- PostgreSQL via `DATABASE_URL` (Prisma). Typical deploy: **same VPS** as the app ([docs/11-infra.md](docs/11-infra.md) inventory is still blank).
- Live ingest: UDP/RTP → FFmpeg child in `IngestService` → `backend/output/<streamId>/` HLS + `recording.mp4`. `hls_flags delete_segments` keeps a **short** live window.
- Archive: `FfmpegPipeline.generateArchive` copies/transcodes recording or playlist → `archive.mp4`. Empty tests (no video) do not produce an archive.
- Files: `backend/uploads/` (avatars, VOD), `backend/output/` (HLS, recordings, archives), `backend/mail-outbox/`.
- Backups: `BackupService` after ~15s then every `BACKUP_INTERVAL_HOURS` (default 24) into `BACKUP_DIR` or `backend/backups/`. Copies DB (`pg_dump -Fc` or JSON tables), media (no `.ts`/`.m3u8`), `.env` + Prisma schema. After each run: `verify.json`, optional S3/B2/Wasabi upload + HeadObject (`docs/backup-offsite.md`), `BackupRun.ok` only if snapshot + verify (+ offsite when enabled/required) pass, `backup_fail` otherwise. Admin: `/admin/backups`.
- Email: `MailService` SMTP if `SMTP_HOST/USER/PASS` set; otherwise HTML outbox. `EmailLog` in Postgres. Ops alerts: `ops_alert` to `ADMIN_EMAIL`.
- SSL: **not in git**. Docs recommend Nginx + Certbot on a future VPS. Local/dev is HTTP.
- Process manager: [`ecosystem.config.js`](ecosystem.config.js) — `liveshow-api` / `liveshow-web`, **1 instance fork**, `autorestart`, `max_restarts: 10`, API `max_memory_restart: 1024M` (web **512M**), logs `logs/api-*.log`, `logs/web-*.log`.
- Health: `GET /health/live` (process), `GET /health/ready` (db, ffmpeg, storage, disk, smtp), `GET /health/uptime` (200/503). Ops kinds: `db_down`, `disk_low`, `ingest_fail`, `stream_start`, `archive_fail`, `backup_fail`, `smtp_fail`.

**Hard constraint:** ingest holds UDP sockets and FFmpeg children **in one Node process**. PM2 cluster / multiple API replicas will double-bind UDP. DR means **one API instance**.

Fill [docs/ops-inventory.md](docs/ops-inventory.md) (and [docs/11-infra.md](docs/11-infra.md) §11.1) when you have a real host (IP, SSH, Postgres location). Until then, treat “the machine that runs Nest” as the only recovery target.

---

## 1. Database failure

### Scenarios (real)

| Scenario | What happens in this stack |
|----------|----------------------------|
| Postgres stopped / crash | Prisma queries fail. API may still answer `/health/live`. `/health/ready` → `db: error`, HTTP 503. Background probe sends `db_down` to `ADMIN_EMAIL` (cooldown `ALERT_COOLDOWN_MINUTES`, default 30). |
| Bad `DATABASE_URL` / auth | Same as down. |
| Disk full on the PG data dir | Writes fail (tickets, EmailLog, backups). Ready disk check watches **app** cwd/`uploads`/`output`, **not** necessarily `/var/lib/postgresql`. |
| Accidental `migrate reset` / DROP | Total data loss except last snapshot in `backups/`. |
| Schema drift after `git checkout` | App boots, then query errors. Rollback is documented in [docs/14-deploy.md](docs/14-deploy.md) §14.4. |

Live viewer counts (`LiveViewTracker`) are **memory-only**; they are not in Postgres. Archive views / tickets / users **are** in Postgres.

### Detection

- `GET /health/ready` → `checks.db.status !== "ok"` (includes `latencyMs`).
- `/admin/monitoring` health card.
- Ops event `db_down`; email type `ops_alert` on `/admin/emails`.
- External monitor on `/health/uptime` (503).
- Postgres logs on the host (path distro-specific; see 11.6).

### Recovery

1. `pm2 status` — is `liveshow-api` looping? Logs: `pm2 logs liveshow-api --lines 80`.
2. On the DB host: `sudo systemctl status postgresql` (or the service name) and `pg_isready`.
3. Confirm `DATABASE_URL` in `backend/.env` (never recover `.env` from git). Snapshot copy: `backups/<id>/config/backend.env`.
4. If the cluster is corrupt and you have `database/postgres.dump`:
   ```bash
   # Use a spare DB first. Then, only if you accept overwrite:
   pg_restore --clean --if-exists -d "$DATABASE_URL" backend/backups/<id>/database/postgres.dump
   ```
   If the snapshot only has `database/*.json`, there is **no automated importer** — restore means a DBA load or a new empty DB + manual import. Prefer installing `pg_dump`/`pg_restore` on PATH so future snapshots are custom-format dumps.
5. `cd backend && npx prisma migrate deploy && npx prisma generate`
6. `pm2 restart liveshow-api`
7. Verify: `/health/ready` `db: ok`, login, one show list.

Do **not** run `prisma migrate reset` on production.

### Estimated recovery time

| Path | Time |
|------|------|
| Postgres service restart, data intact | **5–15 min** |
| Restore `postgres.dump` on same host (small DB) | **30–90 min** including verify |
| JSON-only snapshot / no dump | **hours**; treat as P0 gap |

### Data loss risk

- **RPO** = time since last **successful** `BackupRun` (`/admin/backups` → last success). Default schedule **24 hours**. If `BACKUP_DIR` is on the **same disk** as Postgres, a disk death loses DB **and** backups.
- Transactions since last dump: **gone**.
- In-flight live sessions: not in DB anyway.

---

## 2. Streaming server / ingest failure

There is no separate “streaming server”. Failure **is** Nest (`IngestService`) and/or FFmpeg and/or UDP reachability.

### Scenarios

| Scenario | Code / ops effect |
|----------|-------------------|
| `liveshow-api` crash / `max_memory_restart` | PM2 restarts the process. All FFmpeg children die. `Show.live` may stay `true` until `markNotLive` on ingest stop — after crash, rows can remain live until someone stops or you SQL-update. |
| FFmpeg spawn error / abort | `logStreamError` source `ingest`; `ingest_fail` ops mail. |
| Dashboard start throws | source `dashboard`; `stream_start` alert. Conflict “already running” is ignored. |
| OBS not sending / empty RTP | Ingest may “run” with no pictures. Stop then archive: `Nincs rögzített videó` — **not** alerted. |
| UDP port closed / wrong public IP | Encoder never reaches `0.0.0.0:rtpPort`. No HTTP 503. |
| Two API processes | UDP bind conflict; broken ingest. Config forbids cluster. |

HLS playlist: `backend/output/<streamId>/index.m3u8`. Segments are **deleted** as the window slides. Restart does **not** resume the same live timeline.

### Detection

- `/admin/monitoring` → active streams, `ingestProcess`, `uptimeSec` (`Stream.liveStartedAt`), 24h ingest/start counts.
- `/health/ready` → `ffmpeg: error` if binary missing (does not prove a given stream is healthy).
- `ingest_fail` / `stream_start` in `/admin/monitoring` events and `/admin/emails`.
- Viewers: player stalls; `GET /output/<streamId>/index.m3u8` 403/404.
- PM2: `pm2 logs liveshow-api` lines `FFmpeg ingest`.

### Impact on live viewers

- Process restart: **immediate stall**. HLS window is gone. They must refresh after a **new** ingest start.
- Token (`STREAM_SECRET`, ~1h) still works if the new playlist appears at the same `streamId`.
- Concurrent viewer count resets (in-memory tracker).

### Recovery steps

1. `pm2 describe liveshow-api` — `cwd` must be `backend/` so `output/` is correct.
2. `ffmpeg -version` as the PM2 user (`/health/ready` already checks this).
3. Firewall: UDP `rtpPort` (often 5004) to the **VPS public IP**, not Nginx.
4. Streamer UI `/streamer/live`: stop, then start. Confirm ingest process on `/admin/monitoring`.
5. If `Show.live = true` but no ffmpeg: stop from dashboard (calls `stopIngest` / `markNotLive`) or:
   ```sql
   UPDATE "Show" SET live = false WHERE live = true;
   UPDATE "Stream" SET "isLive" = false WHERE "isLive" = true;
   ```
6. After a real adás, stop so `archiveAfterStop` can run. If `recording.mp4` ≥ 1 KB, archive can still be generated later: admin regenerate or `POST` archive routes.

### Estimated recovery time

- API restart + streamer hits Start: **2–10 min** (viewers rejoin; **live content during the gap is lost**).
- Wrong `cwd` / missing FFmpeg: until the host is fixed (**30+ min**).

---

## 3. Storage exhaustion

### Thresholds (implemented)

- Ready + `disk_low` alert: free bytes on `uploads`, `output`, and `process.cwd()` vs `HEALTH_DISK_MIN_FREE_MB` (**default 512 MB**).
- Backup prune: snapshot folders older than `BACKUP_KEEP_DAYS` (**7**). Does **not** prune `output/` HLS or archives.
- HLS: live `.ts` rotate; **archives and `recording.mp4` grow until deleted manually**.
- Email outbox: `backend/mail-outbox/*.html` unbounded if SMTP is off.

Postgres data directory is **not** in this probe.

### Detection

- `/health/ready` `disk: error` and `checks.disk.detail` (free MB vs min).
- Ops `disk_low` (cooldown applies).
- Host `df -h`.

### Emergency actions (order)

1. Confirm which filesystem is full (`df -h`, `du -sh backend/output backend/uploads backend/backups backend/mail-outbox`).
2. Delete **live** leftover segments only if no one is watching that `streamId` (or after stop): `output/<id>/*.ts`. **Keep** `archive.mp4` / `recording.mp4` unless you accept VOD loss.
3. Remove old `mail-outbox` HTML (already in `EmailLog` if DB is up).
4. Drop old backup snapshots **only if** another copy exists off-box. Default backups **are on the same disk**.
5. Do not fill the disk with a new backup (`BackupService` copies media).

### Recovery

- Expand the volume or move `BACKUP_DIR` and/or `output/` to a larger mount (requires code/env + PM2 `cwd` awareness; HLS root is **always** `process.cwd()/output` unless you change `hls-paths.ts`).
- Re-run `/health/ready` until `disk: ok`.
- Streamer: if ingest failed mid-show, treat as stream outage (section 2).

---

## 4. SSL certificate failure

**Not implemented in the application.** Certificates live on the host if you followed 11.3 (Let's Encrypt under `/etc/letsencrypt/live/<domain>/`). Nest `helmet` HSTS is on only when `NODE_ENV=production`.

### Detection

- Browser NET::ERR_CERT_DATE_INVALID; API CORS/HTTPS failures.
- `sudo certbot certificates` / `echo | openssl s_client -connect api.example.com:443 2>/dev/null | openssl x509 -noout -dates`
- Uptime HTTP monitor will fail if it requires valid TLS (typical). App `/health/*` does **not** check cert expiry.

### Renewal (intended host setup)

```bash
sudo certbot renew --dry-run
sudo certbot renew
sudo nginx -t && sudo systemctl reload nginx
```

Certbot timer: `systemctl status certbot.timer`. Deploy hook (reload Nginx): [docs/ssl-setup.md](docs/ssl-setup.md) §9.

### Recovery

1. `sudo certbot renew --force-renewal` if the cert is expired and rate limits allow.
2. If Nginx points at a stale path, follow [docs/ssl-setup.md](docs/ssl-setup.md) (webroot + `liveshow.conf`). Do not assume Certbot named the live folder `api.YOUR_DOMAIN`.
3. Verify `FRONTEND_URL` / `BACKEND_URL` stay `https://`.
4. If certs are gone: issue new Let's Encrypt certs; DNS A records must hit this VPS.

**RTO:** 15–60 min if DNS and Certbot work; hours if the domain/account is locked by rate limit.

---

## 5. Backup failure

### What a “good” snapshot contains

Under `backend/backups/<iso-id>/` (or `BACKUP_DIR`):

- `manifest.json`, `RESTORE.txt`
- `database/postgres.dump` **or** `database/<Table>.json`
- `media/uploads`, `media/output` (mp4/images; **no live HLS segments**)
- `config/backend.env`, `schema.prisma`, `platform-config.json`, `runtime-env.json`

`BackupRun` rows: `ok` (snapshot parts **and** file verify), `verified`, `verifiedAt`, `verifyError`, `dbMethod`, error text, timestamps. Last verified success: `/admin/backups` and `/admin/monitoring`. Same-disk warning: `sameVolumeAsApp`.

### Detection

- `backup_fail` ops email when snapshot parts fail **or** file verification fails.
- Admin UI last run / history (`ok`, `verified`, `dbMethod`).
- Missing `pg_dump`: DB part still “ok” via JSON fallback — `verify.json` records `method: json-fallback` (warning). Restore remains weak until `pg_dump` is on PATH.

### Recovery

1. Read `manifest.json` `parts.*.error`.
2. Disk: see section 3.
3. `pg_dump` not on PATH: install PostgreSQL client tools; next run should create `postgres.dump`.
4. `.env` unreadable: backup config part fails; fix permissions on `backend/.env`.
5. Manual run: `/admin/backups` → “Mentés most” (`POST /admin/backups/run`).
6. If the Nest backup loop is off: `BACKUP_ENABLED` must not be `false`.

### Backup verification (file check vs restore)

**File check (implemented, not a restore):** after each Nest backup, `verifyBackupSnapshot` writes `verify.json`. CLI: `node scripts/verify-backup.cjs <dir>`. Admin: **Ellenőrzés** → `POST /admin/backups/:id/verify`. Pass = readable `manifest.json` (not `ok:false`), `postgres.dump` ≥64 B **or** JSON tables, `schema.prisma` present. JSON fallback and missing `backend.env` are warnings.

**Restore drill (operator, spare DB only):** [docs/restore-test.md](docs/restore-test.md) — create `liveshow_restore_drill`, `pg_restore --exit-on-error`, Prisma `migrate deploy` on `DRILL_URL`, `scripts/restore-drill-verify.sql`, pass/fail checklist. Do not `pg_restore --clean` against production.

Cadence: file check every snapshot; spare restore **once before launch** and after schema changes; then quarterly.

Default `BACKUP_DIR` on the app disk is **not** disaster-safe. Offsite mount is required for real DR (remaining P0).

---

## 6. Application failure (PM2)

### Processes

| Name | Script | Notes |
|------|--------|--------|
| `liveshow-api` | `backend/dist/main.js` | Must be **fork**, `instances: 1`. `kill_timeout: 8000`. |
| `liveshow-web` | `next start -p 3000` | UI only; ingest does not run here. |

`max_restarts: 10` — after that PM2 **stops retrying** until you `pm2 restart`.

Env in ecosystem: `NODE_ENV=production`, ports 3200/3000. Secrets still come from `backend/.env` via `dotenv` in `main.ts`.

### Recovery process

```bash
cd /path/to/Streaming\ Platform   # repo root (ecosystem cwd relatives)
pm2 status
pm2 logs liveshow-api --lines 100
pm2 logs liveshow-web --lines 50
pm2 restart liveshow-api
pm2 restart liveshow-web
# or both:
pm2 restart liveshow-api liveshow-web
```

If `errored` / restart limit:

```bash
pm2 delete liveshow-api liveshow-web
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
```

Rebuild after bad deploy: [docs/14-deploy.md](docs/14-deploy.md) (npm ci, prisma generate, `migrate deploy`, build, restart). Rollback SHA: same doc §14.4. Never `migrate reset`.

### Verification checklist

- [ ] `pm2 status` both `online`, API memory under 1024M (web 512M) or restarts explained
- [ ] `GET /health/live` 200
- [ ] `GET /health/ready` 200, `db`/`ffmpeg`/`disk`/`storage` ok; `smtp` ok in production
- [ ] `GET http://127.0.0.1:3000` (or public site) 200
- [ ] Login viewer + streamer
- [ ] `/admin/monitoring` loads
- [ ] If a show should be live: ingest row + ffmpeg; else `live` flags false
- [ ] One archive or upload file `200` with stream token if required

---

## 7. Incident runbooks

Assume SSH to the app host. Commands are from repo root unless noted.

### 7.1 Database outage

1. Confirm: `curl -sS http://127.0.0.1:3200/health/ready` → `db`.
2. `sudo systemctl start postgresql` (adjust service name).
3. `pg_isready`; check `backend/.env` `DATABASE_URL`.
4. If data directory destroyed: restore dump (section 1) on spare first.
5. `cd backend && npx prisma migrate deploy`
6. `pm2 restart liveshow-api`
7. `curl` ready again; log in; check `/admin/emails` for `db_down`.
8. Tell streamers: live may need **Start** again.

### 7.2 Stream outage

1. `/admin/monitoring`: active count vs ffmpeg.
2. `pm2 logs liveshow-api --lines 80 | tail` — FFmpeg / ingest errors.
3. `pm2 restart liveshow-api` only if the Node process is wedged (drops all live shows).
4. Streamer: Stop then Start on `/streamer/live`.
5. Encoder: UDP to VPS `rtpPort`.
6. After the show: Stop to trigger archive; if needed admin “regenerate archive”.
7. Clear stuck `live` flags (section 2 SQL) if UI lies.

### 7.3 SMTP outage

1. Ready `smtp: error` in production, or `/admin/monitoring` consecutive SMTP failures, or `smtp_fail` mail (if a previous channel still works).
2. Mail still lands in `backend/mail-outbox/` and `EmailLog` (`logged` / `failed`). Users may get **no** inbox mail.
3. Fix `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Restart API.
4. Ready must show `smtp: ok` if `HEALTH_REQUIRE_SMTP` is true (default in production).
5. Do not use ops mail as the only pager if SMTP is the failed component — rely on **Uptime** HTTP 503 (`/health/ready` includes smtp in production) and `/admin/emails`.
6. Optional: resend ticket mail from admin ticket resend if the product action exists for that row.

### 7.4 Full server failure

The repo assumes **one VM**. There is no automated failover.

1. Provision a new Ubuntu 22.04/24.04 host (Node 20, FFmpeg, Postgres **or** point `DATABASE_URL` at managed PG if you had one).
2. DNS A records → new IPv4 (RTP ingest IP **changes** — update OBS).
3. Clone repo, `backend/.env` from password manager or last `config/backend.env` in an **offsite** backup.
4. `npm ci` / build both apps; `npx prisma migrate deploy`.
5. Restore `postgres.dump` if the old PG died with the box.
6. Restore `uploads/` and `output/` archives from snapshot `media/`.
7. Certbot for HTTPS; Nginx as 11.4.
8. `mkdir -p logs && pm2 start ecosystem.config.js && pm2 save && pm2 startup`
9. Set `BACKUP_DIR` to a **second** disk/S3 mount.
10. Smoke checklist (section 6). Inform streamers of new encoder IP.

If backups lived only on the dead disk: **RPO = total loss** of DB and media since last offsite copy (often never).

---

## 8. Recovery objectives (realistic for this codebase)

These are targets **if** P0 gaps below are closed (offsite backups, filled 11.1 inventory, Certbot on the VPS). They are not guaranteed on a laptop `localhost` deploy.

| Service | RTO | RPO | Why |
|---------|-----|-----|-----|
| Postgres (users, tickets, payouts, EmailLog) | 1 hour (service restart) / 4 hours (restore dump) | **24 hours** (default `BACKUP_INTERVAL_HOURS`) | Daily dump; JSON fallback is not a timed restore |
| Nest API / Next (HTTP) | **5–15 min** (PM2) | n/a (stateless except memory) | `autorestart`; 10-restart cap |
| Live ingest / current HLS | **15 min** to start a **new** session | **Live window only** (seconds–minutes of `.ts`) | Segments not in backup; process restart kills FFmpeg |
| Archive VOD (`archive.mp4` / recording) | 1–4 hours (copy from snapshot) | Last successful backup that included `media/output` | `.ts` omitted; missing archive if never generated |
| Avatars / uploads | 1–4 hours | Last backup | Copied in `media/uploads` |
| Config `.env` | 30 min | Last backup `config/backend.env` **or** password manager | Gitignore; not in git |
| Transactional email | 30–60 min (SMTP fix) | Outbox files if disk survived | No mail queue product |
| TLS | 1 hour | n/a | Certbot; not in app |
| Full VM | **4–24 hours** (manual rebuild) | Offsite backup age | No second region, no IaC |

**Do not advertise** “zero data loss” or “hot standby”. `LiveViewTracker` and live HLS are **best-effort**.

---

## 9. Gap analysis

### P0 — required before a public paid launch

**Done in the repo (low-risk, this cycle)**

| Item | Where |
|------|--------|
| Backup file verification | `verify.json`, `scripts/verify-backup.cjs`, `POST /admin/backups/:id/verify` |
| Offsite S3/B2/Wasabi | `offsite-s3.ts`, HeadObject size check, `BACKUP_OFFSITE_KEEP_DAYS`, `backup_fail`; [docs/backup-offsite.md](docs/backup-offsite.md) |
| Backup success/failure tracking | `BackupRun.ok` = parts + verify; `verified`, `dbMethod`; `backup_fail` mail; `/admin/backups` |
| Restore test documentation | [docs/restore-test.md](docs/restore-test.md) (full drill + checklist) |
| Uptime monitoring documentation | [MONITORING.md](MONITORING.md) § Uptime; inventory table |
| Operational inventory template | [docs/ops-inventory.md](docs/ops-inventory.md) |

**Still operator / infra (not coded as automation)**

| Gap | Evidence | Action |
|-----|----------|--------|
| Backups on the same disk as the app/DB | Default `backend/backups/`; UI `sameVolumeAsApp` | Keep a second disk **and** configure `BACKUP_S3_*` ([backup-offsite.md](docs/backup-offsite.md)) |
| No tested `pg_restore` | Docs until you run the drill | One spare-DB restore ([restore-test.md](docs/restore-test.md)); install `pg_dump` |
| VPS/DNS/SSL inventory empty | Template exists, values blank | Fill [ops-inventory.md](docs/ops-inventory.md); issue Certbot certs |
| SMTP required for ops mail | Alerts use `MailService`; if SMTP is down, ops mail fails (outbox still writes) | External HTTP uptime on `/health/uptime` **and** the public site; set `ADMIN_EMAIL` |
| Stuck `Show.live` after API crash | `markNotLive` only on ingest stop/error paths | After crash: dashboard stop or SQL in runbook 7.2 (no watchdog in code) |
| Single UDP ingest IP | Encoder targets one host | Document the public IP for OBS; changing VM = encoder reconfig (runbook 7.4) |
| No DB replica | Single `DATABASE_URL` | Managed Postgres with provider backups **or** proven dump restore |

### P1 — after launch

| Gap | Action |
|-----|--------|
| Disk probe ignores Postgres data dir | Monitor `df` on PG volume or managed-PG metrics |
| No automated backup restore test | Quarterly spare restore |
| `max_restarts: 10` then stop | Alert on PM2 `errored` (host cron or Better Stack process check) |
| Archive not in backup if never generated | Operational rule: stop ingest so `archiveAfterStop` runs |
| Cert expiry not in `/health/ready` | Certbot timer + calendar; optional `certbot certificates` in cron |
| JSON table dump unrestorable automatically | Keep `pg_dump` on the backup host |
| Live viewer / session state | Accept loss; do not build HA until ingest is split |

### P2 — later

| Gap | Action |
|-----|--------|
| No second region / no Terraform | Only if revenue justifies a second VPS + DNS failover (still one ingest IP problem) |
| No CDN / multi-bitrate | [docs/16-roadmap.md](docs/16-roadmap.md) |
| No RTMP | OBS-friendly ingest is a product epic, not DR |
| Object storage for `output/` | Would change `hls-paths.ts` and player URLs |
| PagerDuty | HTTP uptime + `ADMIN_EMAIL` is the current pager |

---

## Related files

| File | Role |
|------|------|
| [MONITORING.md](MONITORING.md) | Probes, alert kinds, PM2 start, Uptime Kuma / Better Stack / UptimeRobot |
| [LAUNCH_READINESS.md](LAUNCH_READINESS.md) | Completed vs remaining DR; production blockers |
| [docs/restore-test.md](docs/restore-test.md) | Spare-DB restore drill |
| [docs/ops-inventory.md](docs/ops-inventory.md) | Fill-in host / DNS / backup / uptime |
| [docs/ssl-setup.md](docs/ssl-setup.md) | Nginx + Certbot, renewal hook |
| [deploy/nginx/liveshow.conf](deploy/nginx/liveshow.conf) | Production site file |
| `backend/src/backup/snapshot-verify.ts` | File-level snapshot checks |
| `backend/src/backup/backup.service.ts` | Snapshot + `BackupRun` + verify |
| [docs/13-streaming.md](docs/13-streaming.md) | Ingest, HLS, archive, `output/` |
| [docs/14-deploy.md](docs/14-deploy.md) | Build, PM2, rollback |
| [ecosystem.config.js](ecosystem.config.js) | Process names and restart policy |
| `backend/src/ops/ops.service.ts` | Ready checks, stream metrics |
| `backend/src/backup/backup.service.ts` | Snapshot + `BackupRun` + `RESTORE.txt` |
| `backend/src/ingest/ingest.service.ts` | FFmpeg children, `markNotLive` |
| `backend/src/mail/mail.service.ts` | SMTP, outbox, `ops_alert` |
