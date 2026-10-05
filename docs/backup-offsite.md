# Offsite backups (S3 / Backblaze B2 / Wasabi)

Local snapshots stay under `BACKUP_DIR` / `backend/backups/<id>/`. That is **the same disk as the app** unless you changed `BACKUP_DIR`. Offsite copies the snapshot to an S3-compatible bucket after local file verify.

Flow (automatic and “Mentés most”):

1. `pg_dump` / media / config → snapshot folder  
2. Local `verify.json`  
3. Upload every file under `BACKUP_S3_PREFIX/<snapshot-id>/`  
4. **HeadObject** each key; fail if `ContentLength` ≠ local size  
5. Prune remote objects older than `BACKUP_OFFSITE_KEEP_DAYS`  
6. `offsite.json` + `BackupRun.offsiteOk`  
7. `backup_fail` ops mail if upload or size check fails (`ADMIN_EMAIL`)

Admin: `/admin/backups` → **Offsite feltöltés** (`POST /admin/backups/:id/offsite`).

## Environment

```env
BACKUP_OFFSITE_ENABLED=true
BACKUP_OFFSITE_REQUIRED=true
BACKUP_OFFSITE_KEEP_DAYS=14
BACKUP_S3_BUCKET=liveshow-backups
BACKUP_S3_REGION=eu-central-1
BACKUP_S3_ACCESS_KEY=
BACKUP_S3_SECRET_KEY=
BACKUP_S3_PREFIX=liveshow
# leave empty for Amazon S3
BACKUP_S3_ENDPOINT=
BACKUP_S3_FORCE_PATH_STYLE=
```

| Variable | Default | Meaning |
|----------|---------|---------|
| `BACKUP_OFFSITE_ENABLED` | true **if** bucket+keys set | Set `false` to skip upload even with keys |
| `BACKUP_OFFSITE_REQUIRED` | true when `NODE_ENV=production` | Fail the BackupRun if offsite is missing or failed |
| `BACKUP_OFFSITE_KEEP_DAYS` | `BACKUP_KEEP_DAYS` or 14 | Remote retention (local prune is still `BACKUP_KEEP_DAYS`) |
| `BACKUP_S3_PREFIX` | `liveshow` | Object prefix, no leading slash |
| `BACKUP_S3_FORCE_PATH_STYLE` | true if `ENDPOINT` set, else false | B2 / Wasabi / MinIO: true. AWS: false |

Do not commit keys. They are excluded from `runtime-env.json` (SECRET / PASS / ACCESS_KEY).

## Amazon S3

1. Bucket (prefer another region than the VPS). Block public access.  
2. IAM user: `s3:PutObject`, `s3:GetObject`, `s3:HeadObject`, `s3:ListBucket`, `s3:DeleteObject` on `arn:aws:s3:::BUCKET` and `arn:aws:s3:::BUCKET/*`.  
3. `BACKUP_S3_ENDPOINT` empty. `BACKUP_S3_REGION` = bucket region. `BACKUP_S3_FORCE_PATH_STYLE=false`.

## Backblaze B2 (S3 API)

1. Bucket, **S3-compatible**.  
2. Application key with read+write.  
3. Endpoint: `https://s3.<region>.backblazeb2.com` (from the B2 bucket page).  
4. `BACKUP_S3_REGION` = that region (e.g. `eu-central-003`).  
5. Path-style: leave default (`true` when endpoint is set).

## Wasabi

1. Bucket in a Wasabi region.  
2. Access key + secret.  
3. Endpoint examples: `https://s3.eu-central-1.wasabisys.com` (match the bucket region).  
4. `BACKUP_S3_REGION` = same region id. Path-style default true.

## Retention

| Copy | Env | What is deleted |
|------|-----|-----------------|
| Local folder | `BACKUP_KEEP_DAYS` (default 7) | Snapshot directories on disk |
| Offsite objects | `BACKUP_OFFSITE_KEEP_DAYS` (default 14) | All keys under `prefix/<old-id>/` |

Keep remote **longer** than local so a disk wipe still has dumps.

## Restore from offsite

```bash
# AWS CLI works against B2/Wasabi with --endpoint-url
aws s3 sync s3://BUCKET/liveshow/<snapshot-id>/ /tmp/liveshow-restore \
  --endpoint-url "$BACKUP_S3_ENDPOINT"
node scripts/verify-backup.cjs /tmp/liveshow-restore
# then docs/restore-test.md on a spare database
```

## Failure alerts

Kind `backup_fail`, service `backup-offsite` when HeadObject/size mismatch, upload error, missing required config, or prune delete errors. Cooldown: `ALERT_COOLDOWN_MINUTES`.

## Checks

- `/admin/backups`: provider, bucket, last offsite time, `offsite OK`  
- After first run: objects listed in the bucket console under `liveshow/<id>/manifest.json`  
- Local `backend/backups/<id>/offsite.json` → `"ok": true`, `"verified"` = file count  

Related: [restore-test.md](./restore-test.md), [11-infra.md](./11-infra.md) §11.5, [12-env.md](./12-env.md).
