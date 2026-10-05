# Operational inventory (fill before launch)

Copy this file or fill [11-infra.md](./11-infra.md) §11.1 with the same facts. Empty cells = **not launch-ready**.

Do not commit secrets. Store passwords in a password manager; the backup copy is `config/backend.env` inside a snapshot **off the app disk**.

## Host

| Field | Value |
|-------|--------|
| Provider | |
| Hostname | |
| Region / DC | |
| Public IPv4 (OBS / RTP target) | |
| IPv6 | |
| OS | |
| vCPU / RAM / disk size | |
| SSH user + key location (not the key) | |
| App path on disk | e.g. `/var/www/liveshow` |
| PM2 names | `liveshow-api`, `liveshow-web` |
| Who gets SSH | |

## DNS / TLS

| Field | Value |
|-------|--------|
| Site hostname | |
| API hostname | |
| LiveKit hostname (`live.`) | |
| Let's Encrypt email | |
| Certbot timer confirmed (`systemctl status certbot.timer`) | yes / no |
| Cert expiry calendar reminder | |

## PostgreSQL

| Field | Value |
|-------|--------|
| Same VM as API or managed | |
| Data directory / managed plan | |
| `pg_dump` / `pg_restore` on API PATH | yes / no |
| Provider automated backups | yes / no / n/a |
| Last restore drill date | |
| Drill operator | |
| Last drill snapshot id | |
| Last drill overall | PASS / FAIL |

## Backups

| Field | Value |
|-------|--------|
| `BACKUP_DIR` (must **not** be only `backend/backups` on the app disk) | |
| Offsite S3/B2/Wasabi (`BACKUP_S3_BUCKET` + keys) | |
| `BACKUP_OFFSITE_KEEP_DAYS` | default 14 |
| `BACKUP_INTERVAL_HOURS` | default 24 |
| `BACKUP_KEEP_DAYS` | default 7 |
| Last **verified** `pg_dump` snapshot id | |
| `sameVolumeAsApp` warning on `/admin/backups` | must be false in prod |

## Uptime monitors (external — required)

Ops email uses SMTP. If mail is down, only these still page you.

| Monitor | URL | Interval | Tool | Dashboard URL |
|---------|-----|----------|------|----------------|
| API ready | `https://<api>/health/uptime` | 60s | Uptime Kuma / Better Stack / UptimeRobot | |
| Marketing site | `https://<www>/` | 60s | same | |
| Optional TLS | keyword check or cert monitor | daily | | |

Setup steps: [MONITORING.md](../MONITORING.md) § Uptime monitoring.

| Field | Value |
|-------|--------|
| `ADMIN_EMAIL` | |
| On-call human | |
| Uptime tool account | |

## Streaming

| Field | Value |
|-------|--------|
| OBS / encoder UDP host | same as public IPv4 |
| Default `rtpPort` | 5004 unless overridden per show |
| Encoder IP allowlist on firewall | yes / no |

## Költségek (havi, kitöltendő)

Admin `/admin/costs` számol a mért használattal. Itt a **számla** összege, amit beírsz Ft-árnak.

| Tétel | Szolgáltató / csomag | Havi Ft |
|-------|----------------------|---------|
| VPS (szerver) | | |
| Managed Postgres (ha nem a VPS) | | |
| Extra tárhely / object storage | | |
| CDN (ha lesz) | | |
| E-mail (SMTP / transactional) | | |
| Egyéb (domain, uptime tool) | | |

| Field | Value |
|-------|--------|
| Provider | |
| `SMTP_HOST` | |
| `HEALTH_REQUIRE_SMTP` | production: true |

## Checklist before paid traffic

- [ ] This inventory filled (no blank host/DNS/backup/uptime rows)
- [ ] `/health/ready` 200 with `smtp: ok` on production
- [ ] Offsite S3/B2/Wasabi configured; `/admin/backups` shows offsite OK
- [ ] Restore drill recorded
- [ ] Two HTTP uptime monitors live
- [ ] `ADMIN_EMAIL` receives a test `ops_alert` (stop ingest badly or `POST` backup verify on a missing id — prefer a planned backup_fail test)
