# Launch readiness (disaster recovery)

Date: 2026-09-08. Scope: LiveShow repo as implemented (Nest + Next + Postgres). This is **not** a sign-off for paid public traffic.

## Completed DR items (in repo)

| P0 item | Status | Evidence |
|---------|--------|----------|
| Backup file verification | Done | `backend/src/backup/snapshot-verify.ts`; each snapshot writes `verify.json`; `POST /admin/backups/:id/verify`; `node scripts/verify-backup.cjs` |
| Backup success/failure tracking | Done | `BackupRun`: `ok` (parts **and** verify), `verified`, `verifiedAt`, `verifyError`, `dbMethod`; `backup_fail` ops mail; `/admin/backups` + `/admin/monitoring` |
| Restore test documentation | Done | [docs/restore-test.md](docs/restore-test.md) (spare DB only) |
| Uptime monitoring documentation | Done | [MONITORING.md](MONITORING.md) — `/health/uptime` **and** public site; 503 = down; SMTP cannot be the only pager |
| Operational inventory template | Done | [docs/ops-inventory.md](docs/ops-inventory.md); pointer in [docs/11-infra.md](docs/11-infra.md) §11.1 |

| Offsite S3 / B2 / Wasabi | Done | `backend/src/backup/offsite-s3.ts`; upload + HeadObject; `BACKUP_OFFSITE_*`; `/admin/backups` retry; [docs/backup-offsite.md](docs/backup-offsite.md) |

## Remaining DR items

Operator / infra work. Not implemented as automation (higher risk or needs a real VPS):

| Item | Why it remains |
|------|----------------|
| Fill S3/B2/Wasabi keys on the VPS | Code is ready; bucket + IAM/app key still operator work |
| Fill inventory + real Certbot | Template is empty until a host exists |
| `pg_dump` / `pg_restore` on PATH + one spare restore drill | File verify ≠ restore; JSON fallback has no importer |
| `ADMIN_EMAIL` + production SMTP (`HEALTH_REQUIRE_SMTP`) | Ops mail otherwise stays in outbox |
| External uptime actually configured | Docs only until Uptime Kuma / Better Stack / UptimeRobot is live |
| Managed Postgres **or** proven dump restore | Single `DATABASE_URL`, no replica |
| Crash-stuck `Show.live` | Runbook SQL / dashboard stop; no watchdog |
| Encoder UDP public IP documented | Inventory field; VM move breaks OBS |

P1/P2 remain as in [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) §9 (PG disk probe, quarterly restore, Certbot calendar, no second region).

## Blockers before production launch

Do **not** take paid traffic until these are true on the production host:

1. **Inventory filled** — [docs/ops-inventory.md](docs/ops-inventory.md) has host, DNS, SSH, `BACKUP_DIR`, encoder IP, `ADMIN_EMAIL`, uptime dashboard URLs.
2. **TLS** — Nginx + Certbot for the public site and API; `FRONTEND_URL` / `BACKEND_URL` are `https://`.
3. **Offsite backups** — `BACKUP_S3_*` set; `/admin/backups` offsite OK; at least one verified `pg_dump` (`dbMethod: pg_dump`). Local `BACKUP_DIR` still should not be the only copy.
4. **Restore drill recorded** — spare-DB `pg_restore` per restore-test.md; date in inventory.
5. **Ready probe green** — `GET /health/ready` 200 with `db`, `ffmpeg`, `storage`, `disk`, and `smtp: ok`.
6. **External monitors live** — `/health/uptime` and the public homepage, alerting on a channel that is not this app’s SMTP.
7. **Secrets** — production JWT (not `secret123`), Stripe/Barion live keys if selling tickets, `ADMIN_EMAIL` receiving a test `ops_alert`.
8. **Single API instance** — PM2 fork, not cluster (UDP ingest).

Until then: local/dev is fine for product work; DR RTO/RPO in the disaster recovery doc **do not apply**.
