# Restore verification drill (repeatable)

This is the **only** approved way to prove a LiveShow backup can be restored. File checks (`verify.json`, `scripts/verify-backup.cjs`, HeadObject) prove files exist. This drill proves **PostgreSQL accepts the dump** and core tables have data.

**Hard rules**

- Never point `pg_restore --clean` at production `DATABASE_URL`.
- Never change PM2 `liveshow-api` env to the drill URL.
- Never run this against the database that serves `/health/ready` in production.
- JSON-only snapshots (`dbMethod: json-fallback`) **fail** this drill. Install `pg_dump` / `pg_restore` and take a new backup first.

Dump format in code: `pg_dump --format custom --no-owner --no-acl` → file `database/postgres.dump`.

Cadence: before first public launch; after Prisma schema changes; then **quarterly**. Log the result in [ops-inventory.md](ops-inventory.md) and copy the checklist at the end of this file.

---

## A. Pick and file-verify the snapshot

1. Admin `/admin/backups`: last success with `dbMethod: pg_dump`, local verify OK, offsite OK if production.
2. Note the snapshot id (folder name). Example: `2026-09-08T18-00-00-000Z`.
3. Source:
   - **Local:** `$SNAP` = `backend/backups/<id>` or `$BACKUP_DIR/<id>` (API `cwd` is `backend/`).
   - **Offsite:** pull to a throwaway dir (not production `cwd`):

```bash
# AWS; add --endpoint-url for B2/Wasabi
aws s3 sync "s3://$BACKUP_S3_BUCKET/${BACKUP_S3_PREFIX:-liveshow}/<id>/" /tmp/liveshow-restore/<id>
export SNAP=/tmp/liveshow-restore/<id>
```

4. File check (does **not** open Postgres):

```bash
node scripts/verify-backup.cjs "$SNAP"
```

**Gate:** JSON `"ok": true` and `"method": "pg_dump"`. If not, **stop — drill FAIL**. Do not create a database yet.

---

## B. Create a test database

Use a **new empty database**. Same Postgres instance is OK if the name is unique. A throwaway Docker/Postgres on another port is safer on a laptop that also runs production-like PM2.

### B1. Linux (system Postgres)

```bash
sudo -u postgres psql -c "SELECT datname FROM pg_database WHERE datname = 'liveshow_restore_drill';"
sudo -u postgres dropdb --if-exists liveshow_restore_drill
sudo -u postgres createdb -E UTF8 -T template0 liveshow_restore_drill
export DRILL_URL="postgresql://postgres:PASSWORD@127.0.0.1:5432/liveshow_restore_drill"
pg_isready -d "$DRILL_URL"
```

### B2. Windows (SQL Shell / `psql`)

```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'liveshow_restore_drill';
DROP DATABASE IF EXISTS liveshow_restore_drill;
CREATE DATABASE liveshow_restore_drill WITH ENCODING 'UTF8' TEMPLATE template0;
```

PowerShell:

```powershell
$env:DRILL_URL = "postgresql://postgres:PASSWORD@127.0.0.1:5432/liveshow_restore_drill"
```

### B3. Isolated Docker (optional)

```bash
docker run --rm --name liveshow-drill-pg -e POSTGRES_PASSWORD=drill -p 5433:5432 -d postgres:16
sleep 5
export DRILL_URL="postgresql://postgres:drill@127.0.0.1:5433/postgres"
psql "$DRILL_URL" -c "CREATE DATABASE liveshow_restore_drill"
export DRILL_URL="postgresql://postgres:drill@127.0.0.1:5433/liveshow_restore_drill"
```

**Gate:** `psql "$DRILL_URL" -c 'SELECT current_database();'` returns `liveshow_restore_drill`. Confirm the host/port is **not** the production DB name.

---

## C. `pg_restore` process

From the machine that has PostgreSQL **client** tools (`pg_restore -V`). Custom-format dump:

```bash
pg_restore -l "$SNAP/database/postgres.dump" | head
```

You should see TOC entries (schemas, tables, `_prisma_migrations`). Empty list → **FAIL**.

Restore into the **empty** drill DB:

```bash
pg_restore \
  --verbose \
  --exit-on-error \
  --no-owner \
  --no-acl \
  --dbname="$DRILL_URL" \
  "$SNAP/database/postgres.dump"
```

- `--exit-on-error` = any error is a **FAIL** (do not ignore “errors ignored”).
- `--clean --if-exists` is optional on a brand-new database. Use it if you re-run the drill on an existing `liveshow_restore_drill` after a failed attempt:

```bash
pg_restore --clean --if-exists --exit-on-error --no-owner --no-acl \
  --dbname="$DRILL_URL" "$SNAP/database/postgres.dump"
```

**Do not** add `--create` unless you intend `pg_restore` to emit `CREATE DATABASE` (needs connection to `postgres`, not the drill DB). This procedure uses `createdb` first.

If restore fails: dump is corrupt, tools version mismatch, or you aimed at a non-empty DB with objects that conflict. Fix `pg_dump` on the API host, take a **new** snapshot, restart from A. Do not “repair” production.

---

## D. Schema after restore (Prisma)

The dump already contains tables. Apply **only missing** migrations from the **same git SHA as the snapshot** (or production SHA if the dump is from that release):

```bash
cd backend
export DATABASE_URL="$DRILL_URL"
npx prisma migrate deploy
npx prisma migrate status
```

Unset `DATABASE_URL` afterward so your shell cannot hit the drill DB by accident (`unset DATABASE_URL` / close the window).

**Gate:** `migrate status` is up to date **or** only lists migrations added **after** the snapshot (expected). Unexpected failed migrations → **FAIL**.

---

## E. Verification steps (data + files)

Run counts against the **drill** URL only:

```bash
psql "$DRILL_URL" -v ON_ERROR_STOP=1 -f scripts/restore-drill-verify.sql
```

Or paste:

```sql
SELECT current_database();                          -- must be liveshow_restore_drill
SELECT COUNT(*) AS prisma_migrations FROM _prisma_migrations;
SELECT COUNT(*) AS users FROM "User";
SELECT COUNT(*) AS shows FROM "Show";
SELECT COUNT(*) AS streamers FROM "Streamer";
```

Compare **order of magnitude** to production (read-only on prod):

```sql
-- production, SELECT only
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Show";
```

| Check | Pass if |
|-------|---------|
| Database name | Exactly `liveshow_restore_drill` (or your documented drill name) |
| `_prisma_migrations` | Count ≥ 1 |
| `"User"` | Count equals production ± expected growth since snapshot (or ≥ 1 on a real env) |
| `"Show"` | Same idea |
| `config/platform-config.json` vs `SELECT * FROM "PlatformConfig"` | Commission percent matches |
| `config/schema.prisma` | Present in snapshot |
| Media (optional) | `media/uploads` / `media/output` copy to a **temp** folder; live `.ts` **absent** (by design) |

Optional app smoke (port **3210**, never 3200 if prod is up):

```bash
# throwaway clone + drill URL only
PORT=3210 DATABASE_URL="$DRILL_URL" node dist/main.js
# other terminal:
curl -sS http://127.0.0.1:3210/health/ready
```

Expect `db: ok`. Then **stop** that process. Do not leave it running.

---

## F. Tear down

```bash
unset DATABASE_URL
# Linux
sudo -u postgres dropdb liveshow_restore_drill
# Docker
docker stop liveshow-drill-pg
rm -rf /tmp/liveshow-restore
```

Windows: `DROP DATABASE liveshow_restore_drill;`

---

## G. Pass / fail checklist

Copy a row into [ops-inventory.md](ops-inventory.md) (Last restore drill). **Pass** = every Pass line is yes. One Fail line = drill **FAIL** (do not declare DR ready).

| # | Step | Pass | Fail |
|---|------|------|------|
| 1 | Snapshot `dbMethod` is `pg_dump` | ☐ | JSON fallback / no dump |
| 2 | `node scripts/verify-backup.cjs` `"ok": true` | ☐ | errors in JSON |
| 3 | Offsite pull used if this is a production drill | ☐ / n/a | restored only from app disk with `sameVolumeAsApp` |
| 4 | Drill DB created empty; name is not production | ☐ | restored into live `DATABASE_URL` |
| 5 | `pg_restore -l` shows a TOC | ☐ | empty or unreadable dump |
| 6 | `pg_restore --exit-on-error` exit code 0 | ☐ | errors, version mismatch, wrong DB |
| 7 | `prisma migrate deploy` on **DRILL_URL** only | ☐ | migrate on production; failed migrations |
| 8 | `_prisma_migrations` and `"User"` counts sensible vs prod | ☐ | empty User on a known-populated prod |
| 9 | PlatformConfig / commission matches snapshot JSON | ☐ | missing or wildly different |
| 10 | Drill DB dropped; prod `/health/ready` still 200 | ☐ | prod down or drill DB left as default URL |

**Overall:** ☐ PASS ☐ FAIL  

Date: ________ Operator: ________ Snapshot id: ________ Source: local / S3 / B2 / Wasabi  

Notes: ________

---

## JSON-only snapshots (automatic fail)

There is **no** importer for `database/*.json`. Do not mark the drill passed. Install client tools on `liveshow-api`, run a new backup, confirm `postgres.dump` ≥ 64 bytes, then repeat from A.

---

## Related

- Snapshot layout: `manifest.json`, `RESTORE.txt`, `database/postgres.dump`, `media/`, `config/`
- Offsite: [backup-offsite.md](backup-offsite.md)
- Production disaster restore (after a real outage): [DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md) §1 — still restore to spare first, then cut over
- SQL helper: [scripts/restore-drill-verify.sql](../scripts/restore-drill-verify.sql)
