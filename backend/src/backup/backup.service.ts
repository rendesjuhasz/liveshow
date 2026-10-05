import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { isBackupDirOnAppVolume, verifyBackupSnapshot } from "./snapshot-verify";
import {
    offsiteKeepDays,
    offsitePublicStatus,
    pruneOffsiteSnapshots,
    uploadAndVerifySnapshot,
    type OffsiteResult,
} from "./offsite-s3";

export type BackupPart = {
    ok: boolean;
    method?: string;
    bytes?: number;
    files?: number;
    error?: string;
};

export type BackupManifest = {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    ok: boolean;
    automatic: boolean;
    dir: string;
    parts: {
        database: BackupPart;
        media: BackupPart;
        config: BackupPart;
    };
    verify?: import("./snapshot-verify").SnapshotVerify;
    offsite?: OffsiteResult;
};

const SKIP_MEDIA_EXT = new Set([".ts", ".m3u8", ".tmp", ".part"]);

@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BackupService.name);
    private timer: ReturnType<typeof setInterval> | null = null;
    private startup: ReturnType<typeof setTimeout> | null = null;
    private running = false;
    private last: BackupManifest | null = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
    ) {}

    onModuleInit() {
        if (!this.enabled()) {
            this.logger.warn("Automatikus backup ki van kapcsolva (BACKUP_ENABLED=false).");
            return;
        }
        this.startup = setTimeout(() => {
            void this.run({ automatic: true });
        }, this.startupDelayMs());
        this.timer = setInterval(() => {
            void this.run({ automatic: true });
        }, this.intervalMs());
        this.logger.log(
            `Automatikus backup: első futás ${Math.round(this.startupDelayMs() / 1000)} mp múlva, utána ${Math.round(this.intervalMs() / 3600000)} óránként. Könyvtár: ${this.rootDir()}`,
        );
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
        if (this.startup) clearTimeout(this.startup);
    }

    enabled() {
        const raw = String(process.env.BACKUP_ENABLED || "true").toLowerCase();
        return raw !== "false" && raw !== "0" && raw !== "off";
    }

    intervalMs() {
        const hours = Number(process.env.BACKUP_INTERVAL_HOURS || 24);
        const ms = hours * 60 * 60 * 1000;
        return Number.isFinite(ms) && ms >= 60 * 60 * 1000 ? ms : 24 * 60 * 60 * 1000;
    }

    keepDays() {
        const days = Number(process.env.BACKUP_KEEP_DAYS || 7);
        return Number.isFinite(days) && days >= 1 ? Math.min(90, Math.floor(days)) : 7;
    }

    rootDir() {
        const custom = String(process.env.BACKUP_DIR || "").trim();
        if (custom) return path.resolve(custom);
        return path.join(process.cwd(), "backups");
    }

    async status() {
        const history = await this.history(20);
        const lastSuccess =
            history.find((row) => row.ok && row.verified && this.offsiteSatisfied(row)) ||
            (await this.lastSuccessRow()) ||
            history.find((row) => row.ok);
        const offsite = offsitePublicStatus();
        return {
            enabled: this.enabled(),
            running: this.running,
            intervalHours: Math.round(this.intervalMs() / 3600000),
            keepDays: this.keepDays(),
            offsiteKeepDays: offsiteKeepDays(),
            dir: this.rootDir(),
            last: this.last || this.readLatestManifest(),
            lastSuccessAt: lastSuccess?.finishedAt || lastSuccess?.startedAt || null,
            lastSuccessMethod: lastSuccess?.dbMethod || null,
            lastVerifiedAt: lastSuccess?.verifiedAt || null,
            lastOffsiteAt: lastSuccess?.offsiteAt || null,
            sameVolumeAsApp: isBackupDirOnAppVolume(this.rootDir(), process.cwd()),
            offsite,
            history,
            snapshots: this.listSnapshots(),
        };
    }

    listSnapshots() {
        const root = this.rootDir();
        if (!fs.existsSync(root)) return [];
        return fs
            .readdirSync(root, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => {
                const dir = path.join(root, entry.name);
                const manifest = this.readManifest(dir);
                return {
                    id: entry.name,
                    dir,
                    ok: manifest?.ok ?? false,
                    startedAt: manifest?.startedAt || null,
                    finishedAt: manifest?.finishedAt || null,
                    automatic: manifest?.automatic ?? null,
                    bytes: this.dirBytes(dir),
                    parts: manifest?.parts || null,
                    verify: this.readVerify(dir),
                    offsite: this.readOffsite(dir),
                };
            })
            .sort((a, b) => String(b.startedAt || b.id).localeCompare(String(a.startedAt || a.id)));
    }

    async run(opts?: { automatic?: boolean }) {
        if (this.running) {
            return { ok: false, error: "Már fut egy mentés.", last: this.last };
        }
        this.running = true;
        const id = this.stamp();
        const dir = path.join(this.rootDir(), id);
        const manifest: BackupManifest = {
            id,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            ok: false,
            automatic: opts?.automatic !== false,
            dir,
            parts: {
                database: { ok: false },
                media: { ok: false },
                config: { ok: false },
            },
        };
        try {
            fs.mkdirSync(dir, { recursive: true });
            manifest.parts.database = await this.backupDatabase(path.join(dir, "database"));
            manifest.parts.media = await this.backupMedia(path.join(dir, "media"));
            manifest.parts.config = await this.backupConfig(path.join(dir, "config"));
            this.writeRestoreHint(dir);
            manifest.ok =
                manifest.parts.database.ok &&
                manifest.parts.media.ok &&
                manifest.parts.config.ok;
            manifest.finishedAt = new Date().toISOString();
            fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
            this.prune();
            const verify = verifyBackupSnapshot(dir);
            manifest.verify = verify;
            fs.writeFileSync(path.join(dir, "verify.json"), JSON.stringify(verify, null, 2), "utf8");
            const offsite = await this.syncOffsite(dir, id, Boolean(manifest.ok && verify.ok));
            manifest.offsite = offsite;
            this.last = manifest;
            this.logger.log(
                `Backup ${id}: db=${manifest.parts.database.ok} media=${manifest.parts.media.ok} config=${manifest.parts.config.ok} verify=${verify.ok} offsite=${offsite.skipped ? "skip" : offsite.ok}`,
            );
            await this.recordRun(manifest, undefined, verify, offsite);
            return manifest;
        } catch (err: any) {
            manifest.finishedAt = new Date().toISOString();
            manifest.ok = false;
            this.last = manifest;
            this.logger.warn(`Backup sikertelen: ${err?.message || err}`);
            try {
                fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
            } catch {
                /* ignore */
            }
            await this.recordRun(manifest, err?.message, verifyBackupSnapshot(dir));
            return manifest;
        } finally {
            this.running = false;
        }
    }

    private startupDelayMs() {
        const ms = Number(process.env.BACKUP_STARTUP_DELAY_MS || 15_000);
        return Number.isFinite(ms) && ms >= 0 ? ms : 15_000;
    }

    private stamp() {
        return new Date().toISOString().replace(/[:.]/g, "-");
    }

    async verifySnapshot(id: string) {
        await this.ensureHistory();
        const safe = this.safeSnapshotId(id);
        const dir = path.join(this.rootDir(), safe);
        const verify = verifyBackupSnapshot(dir);
        try {
            fs.writeFileSync(path.join(dir, "verify.json"), JSON.stringify(verify, null, 2), "utf8");
        } catch {
            /* ignore */
        }
        void this.prisma.$executeRaw`
            UPDATE "BackupRun"
            SET verified = ${verify.ok},
                "verifiedAt" = NOW(),
                "verifyError" = ${verify.errors.join("; ") || null},
                "dbMethod" = ${verify.method}
            WHERE id = ${safe}
        `.catch(() => undefined);
        if (!verify.ok) {
            void this.mail.opsAlert({
                kind: "backup_fail",
                service: "backup",
                message: "A backup fájlellenőrzés sikertelen.",
                detail: verify.errors.join("; "),
            });
        }
        return { id: safe, dir, verify };
    }

    async uploadOffsite(id: string) {
        const safe = this.safeSnapshotId(id);
        const dir = path.join(this.rootDir(), safe);
        if (!fs.existsSync(dir)) {
            throw new BadRequestException("A snapshot nem található.");
        }
        const local = verifyBackupSnapshot(dir);
        const offsite = await this.syncOffsite(dir, safe, local.ok);
        await this.ensureHistory();
        void this.prisma.$executeRaw`
            UPDATE "BackupRun"
            SET "offsiteOk" = ${offsite.ok},
                "offsiteAt" = NOW(),
                "offsiteError" = ${offsite.errors.join("; ") || null},
                "offsiteBytes" = ${offsite.bytes}
            WHERE id = ${safe}
        `.catch(() => undefined);
        if (!offsite.ok && !offsite.skipped) {
            void this.mail.opsAlert({
                kind: "backup_fail",
                service: "backup-offsite",
                message: "Az offsite (S3) feltöltés vagy ellenőrzés sikertelen.",
                detail: offsite.errors.join("; "),
            });
        }
        return { id: safe, dir, offsite };
    }

    private async syncOffsite(dir: string, id: string, localOk: boolean): Promise<OffsiteResult> {
        const st = offsitePublicStatus();
        if (!localOk) {
            const blocked: OffsiteResult = {
                ok: false,
                skipped: true,
                provider: st.provider,
                bucket: st.bucket,
                prefix: st.prefix,
                region: st.region,
                endpoint: st.endpoint,
                files: 0,
                bytes: 0,
                verified: 0,
                deleted: 0,
                errors: ["Helyi snapshot nem OK, offsite feltöltés kihagyva."],
                finishedAt: new Date().toISOString(),
            };
            this.writeOffsite(dir, blocked);
            return blocked;
        }
        if (st.required && !st.configured) {
            const missing: OffsiteResult = {
                ok: false,
                skipped: false,
                provider: st.provider,
                bucket: st.bucket,
                prefix: st.prefix,
                region: st.region,
                endpoint: st.endpoint,
                files: 0,
                bytes: 0,
                verified: 0,
                deleted: 0,
                errors: ["BACKUP_OFFSITE_REQUIRED, de nincs S3/B2/Wasabi kulcs (BACKUP_S3_*)."],
                finishedAt: new Date().toISOString(),
            };
            this.writeOffsite(dir, missing);
            return missing;
        }
        const result = await uploadAndVerifySnapshot(dir, id);
        if (result.ok || (result.skipped && !st.required)) {
            const prune = await pruneOffsiteSnapshots().catch((err: any) => ({
                deleted: 0,
                errors: [err?.message || "offsite prune"],
            }));
            result.deleted = prune.deleted;
            if (prune.errors.length) {
                void this.mail.opsAlert({
                    kind: "backup_fail",
                    service: "backup-offsite",
                    message: "Offsite megőrzés (törlés) részben sikertelen.",
                    detail: prune.errors.join("; "),
                });
            }
        }
        this.writeOffsite(dir, result);
        return result;
    }

    private writeOffsite(dir: string, offsite: OffsiteResult) {
        try {
            fs.writeFileSync(path.join(dir, "offsite.json"), JSON.stringify(offsite, null, 2), "utf8");
        } catch {
            /* ignore */
        }
    }

    private offsiteSatisfied(row: { offsiteOk?: boolean | null }) {
        const st = offsitePublicStatus();
        if (!st.enabled && !st.required) return true;
        return row.offsiteOk === true;
    }

    private safeSnapshotId(id: string) {
        const safe = String(id || "").replace(/[^0-9A-Za-z._-]/g, "");
        if (!safe || safe !== id) {
            throw new BadRequestException("Érvénytelen snapshot azonosító.");
        }
        return safe;
    }

    private async recordRun(
        manifest: BackupManifest,
        error?: string,
        verify?: import("./snapshot-verify").SnapshotVerify,
        offsite?: OffsiteResult,
    ) {
        await this.ensureHistory();
        const checked = verify || verifyBackupSnapshot(manifest.dir);
        const err =
            error ||
            (!manifest.ok
                ? Object.entries(manifest.parts)
                      .filter(([, part]) => !part.ok)
                      .map(([name, part]) => `${name}: ${part.error || "hiba"}`)
                      .join("; ")
                : null);
        const verifyError = checked.errors.join("; ") || null;
        const remote = offsite || manifest.offsite;
        const st = offsitePublicStatus();
        const offsiteOk = remote ? Boolean(remote.ok) : !st.enabled && !st.required;
        const success = Boolean(manifest.ok && checked.ok && offsiteOk);
        await this.prisma.$executeRaw`
            INSERT INTO "BackupRun" (
                id, "startedAt", "finishedAt", ok, automatic, dir, error, parts,
                verified, "verifiedAt", "verifyError", "dbMethod",
                "offsiteOk", "offsiteAt", "offsiteError", "offsiteBytes"
            )
            VALUES (
                ${manifest.id},
                ${new Date(manifest.startedAt)},
                ${manifest.finishedAt ? new Date(manifest.finishedAt) : null},
                ${success},
                ${manifest.automatic},
                ${manifest.dir},
                ${err},
                ${JSON.stringify(manifest.parts)},
                ${checked.ok},
                NOW(),
                ${verifyError},
                ${checked.method},
                ${offsiteOk},
                ${remote ? new Date(remote.finishedAt) : null},
                ${remote?.errors?.length ? remote.errors.join("; ") : null},
                ${remote?.bytes || 0}
            )
        `.catch(() => undefined);
        if (!success) {
            void this.mail.opsAlert({
                kind: "backup_fail",
                service: remote && !remote.ok && !remote.skipped ? "backup-offsite" : "backup",
                message: "A biztonsági mentés, a fájlellenőrzés vagy az offsite feltöltés elbukott.",
                detail: err || verifyError || remote?.errors?.join("; "),
            });
        }
    }

    private async history(limit = 20) {
        await this.ensureHistory();
        const take = Math.min(50, Math.max(1, limit));
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT id, "startedAt", "finishedAt", ok, automatic, dir, error,
                   verified, "verifiedAt", "verifyError", "dbMethod",
                   "offsiteOk", "offsiteAt", "offsiteError", "offsiteBytes"
            FROM "BackupRun"
            ORDER BY "startedAt" DESC
            LIMIT ${take}
        `.catch(() => []);
        return rows.map((row) => ({
            id: row.id,
            startedAt: row.startedAt,
            finishedAt: row.finishedAt,
            ok: Boolean(row.ok),
            automatic: Boolean(row.automatic),
            dir: row.dir,
            error: row.error || null,
            verified: row.verified == null ? null : Boolean(row.verified),
            verifiedAt: row.verifiedAt || null,
            verifyError: row.verifyError || null,
            dbMethod: row.dbMethod || null,
            offsiteOk: row.offsiteOk == null ? null : Boolean(row.offsiteOk),
            offsiteAt: row.offsiteAt || null,
            offsiteError: row.offsiteError || null,
            offsiteBytes: Number(row.offsiteBytes) || 0,
        }));
    }

    private async lastSuccessRow() {
        await this.ensureHistory();
        const needOffsite = offsitePublicStatus().enabled || offsitePublicStatus().required;
        const rows = needOffsite
            ? await this.prisma.$queryRaw<any[]>`
                SELECT "finishedAt", "startedAt", "dbMethod", "verifiedAt", "offsiteAt", "offsiteOk" FROM "BackupRun"
                WHERE ok = true AND COALESCE(verified, false) = true AND COALESCE("offsiteOk", false) = true
                ORDER BY "startedAt" DESC
                LIMIT 1
            `.catch(() => [])
            : await this.prisma.$queryRaw<any[]>`
                SELECT "finishedAt", "startedAt", "dbMethod", "verifiedAt", "offsiteAt", "offsiteOk" FROM "BackupRun"
                WHERE ok = true AND COALESCE(verified, false) = true
                ORDER BY "startedAt" DESC
                LIMIT 1
            `.catch(() => []);
        return rows[0] || null;
    }

    private async ensureHistory() {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "BackupRun" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "startedAt" TIMESTAMPTZ NOT NULL,
                "finishedAt" TIMESTAMPTZ,
                ok BOOLEAN NOT NULL DEFAULT false,
                automatic BOOLEAN NOT NULL DEFAULT true,
                dir TEXT,
                error TEXT,
                parts TEXT
            )
        `).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "BackupRun" ADD COLUMN IF NOT EXISTS verified BOOLEAN`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "BackupRun" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMPTZ`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "BackupRun" ADD COLUMN IF NOT EXISTS "verifyError" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "BackupRun" ADD COLUMN IF NOT EXISTS "dbMethod" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "BackupRun" ADD COLUMN IF NOT EXISTS "offsiteOk" BOOLEAN`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "BackupRun" ADD COLUMN IF NOT EXISTS "offsiteAt" TIMESTAMPTZ`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "BackupRun" ADD COLUMN IF NOT EXISTS "offsiteError" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "BackupRun" ADD COLUMN IF NOT EXISTS "offsiteBytes" BIGINT`,
        ).catch(() => undefined);
    }

    private async backupDatabase(dir: string): Promise<BackupPart> {
        fs.mkdirSync(dir, { recursive: true });
        const dumpFile = path.join(dir, "postgres.dump");
        const dumped = await this.tryPgDump(dumpFile);
        if (dumped) {
            return {
                ok: true,
                method: "pg_dump",
                bytes: this.fileBytes(dumpFile),
                files: 1,
            };
        }
        try {
            const tables = await this.prisma.$queryRaw<{ tablename: string }[]>`
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public'
                ORDER BY tablename
            `;
            const names = tables
                .map((row) => row.tablename)
                .filter((name) => /^[A-Za-z0-9_]+$/.test(name));
            let files = 0;
            for (const name of names) {
                const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "${name}"`);
                fs.writeFileSync(
                    path.join(dir, `${name}.json`),
                    JSON.stringify(this.jsonSafe(rows), null, 2),
                    "utf8",
                );
                files += 1;
            }
            fs.writeFileSync(
                path.join(dir, "tables.json"),
                JSON.stringify({ tables: names, method: "json-fallback" }, null, 2),
                "utf8",
            );
            return { ok: true, method: "json-fallback", bytes: this.dirBytes(dir), files };
        } catch (err: any) {
            return { ok: false, error: err?.message || "Adatbázis mentés sikertelen." };
        }
    }

    private tryPgDump(outFile: string) {
        const url = String(process.env.DATABASE_URL || "").trim();
        if (!url) return Promise.resolve(false);
        return new Promise<boolean>((resolve) => {
            execFile(
                "pg_dump",
                ["--dbname", url, "--format", "custom", "--file", outFile, "--no-owner", "--no-acl"],
                { timeout: 10 * 60 * 1000, windowsHide: true },
                (err) => {
                    if (err || !fs.existsSync(outFile) || fs.statSync(outFile).size <= 0) {
                        resolve(false);
                        return;
                    }
                    resolve(true);
                },
            );
        });
    }

    private async backupMedia(dir: string): Promise<BackupPart> {
        try {
            fs.mkdirSync(dir, { recursive: true });
            const uploads = path.join(process.cwd(), "uploads");
            const output = path.join(process.cwd(), "output");
            let files = 0;
            if (fs.existsSync(uploads)) {
                files += this.copyFiltered(uploads, path.join(dir, "uploads"));
            }
            if (fs.existsSync(output)) {
                files += this.copyFiltered(output, path.join(dir, "output"));
            }
            return { ok: true, method: "copy", bytes: this.dirBytes(dir), files };
        } catch (err: any) {
            return { ok: false, error: err?.message || "Média mentés sikertelen." };
        }
    }

    private async backupConfig(dir: string): Promise<BackupPart> {
        try {
            fs.mkdirSync(dir, { recursive: true });
            const copies: Array<[string, string]> = [
                [path.join(process.cwd(), ".env"), "backend.env"],
                [path.join(process.cwd(), "prisma", "schema.prisma"), "schema.prisma"],
                [path.join(process.cwd(), "..", "frontend", ".env"), "frontend.env"],
                [path.join(process.cwd(), "..", "frontend", ".env.local"), "frontend.env.local"],
            ];
            let files = 0;
            for (const [from, name] of copies) {
                if (!fs.existsSync(from) || !fs.statSync(from).isFile()) continue;
                fs.copyFileSync(from, path.join(dir, name));
                files += 1;
            }
            const platform = await this.prisma.$queryRaw<any[]>`
                SELECT * FROM "PlatformConfig"
            `.catch(() => []);
            fs.writeFileSync(
                path.join(dir, "platform-config.json"),
                JSON.stringify(this.jsonSafe(platform), null, 2),
                "utf8",
            );
            files += 1;
            const envKeys = Object.keys(process.env)
                .filter((key) => this.isAppEnvKey(key))
                .sort();
            const envSnapshot: Record<string, string> = {};
            for (const key of envKeys) {
                envSnapshot[key] = String(process.env[key] ?? "");
            }
            fs.writeFileSync(
                path.join(dir, "runtime-env.json"),
                JSON.stringify(envSnapshot, null, 2),
                "utf8",
            );
            files += 1;
            fs.writeFileSync(
                path.join(dir, "runtime-meta.json"),
                JSON.stringify(
                    {
                        nodeEnv: process.env.NODE_ENV || "development",
                        port: process.env.PORT || "3200",
                        frontendUrl: process.env.FRONTEND_URL || "",
                        backendUrl: process.env.BACKEND_URL || "",
                        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
                        hasJwtSecret: Boolean(process.env.JWT_SECRET),
                        hasStripe: Boolean(process.env.STRIPE_SECRET_KEY),
                        hasSmtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
                    },
                    null,
                    2,
                ),
                "utf8",
            );
            files += 1;
            return { ok: true, method: "copy", bytes: this.dirBytes(dir), files };
        } catch (err: any) {
            return { ok: false, error: err?.message || "Konfiguráció mentés sikertelen." };
        }
    }

    private isAppEnvKey(key: string) {
        return /^(DATABASE_URL|PORT|FRONTEND_URL|BACKEND_URL|JWT_SECRET|ALLOW_DEV_PAY|BOOTSTRAP_ADMIN_EMAIL|STREAM_SECRET|SMTP_|MAIL_|ADMIN_EMAIL|CONTACT_EMAIL|STRIPE_|BARION_|BACKUP_|NEXT_PUBLIC_)/.test(
            key,
        ) && !/(SECRET|PASS|ACCESS_KEY|TOKEN)/i.test(key);
    }

    private copyFiltered(src: string, dest: string) {
        let files = 0;
        const walk = (from: string, to: string) => {
            fs.mkdirSync(to, { recursive: true });
            for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
                const nextFrom = path.join(from, entry.name);
                const nextTo = path.join(to, entry.name);
                if (entry.isDirectory()) {
                    walk(nextFrom, nextTo);
                    continue;
                }
                if (!entry.isFile()) continue;
                const ext = path.extname(entry.name).toLowerCase();
                if (SKIP_MEDIA_EXT.has(ext)) continue;
                fs.copyFileSync(nextFrom, nextTo);
                files += 1;
            }
        };
        walk(src, dest);
        return files;
    }

    private prune() {
        const keepMs = this.keepDays() * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - keepMs;
        for (const snap of this.listSnapshots()) {
            const t = snap.startedAt ? Date.parse(snap.startedAt) : 0;
            if (!t || t >= cutoff) continue;
            fs.rmSync(snap.dir, { recursive: true, force: true });
        }
    }

    private writeRestoreHint(dir: string) {
        const text = [
            "LiveShow mentés",
            "",
            "1. Adatbázis: ha van database/postgres.dump → pg_restore --clean --if-exists -d DATABASE_URL database/postgres.dump",
            "   különben a database/*.json táblánkénti export (manuális import).",
            "2. Média: media/uploads → backend/uploads, media/output → backend/output (élő .ts szegmensek nincsenek a mentésben).",
            "3. Konfig: config/backend.env → backend/.env, config/schema.prisma ellenőrzés, platform-config.json.",
            "4. Prisma: prisma migrate deploy, majd indítás.",
            "5. Fájlellenőrzés: node scripts/verify-backup.cjs <ez a mappa>",
            "6. Restore drill: docs/restore-test.md (createdb liveshow_restore_drill, soha ne a production DB-n).",
            "7. Offsite: docs/backup-offsite.md — aws s3 cp / B2 / Wasabi a BACKUP_S3_PREFIX/<id>/ alá.",
            "",
        ].join("\n");
        fs.writeFileSync(path.join(dir, "RESTORE.txt"), text, "utf8");
    }

    private readLatestManifest() {
        const first = this.listSnapshots()[0];
        if (!first) return null;
        return this.readManifest(first.dir);
    }

    private readOffsite(dir: string) {
        const file = path.join(dir, "offsite.json");
        if (!fs.existsSync(file)) return null;
        try {
            return JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {
            return null;
        }
    }

    private readVerify(dir: string) {
        const file = path.join(dir, "verify.json");
        if (!fs.existsSync(file)) return null;
        try {
            return JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {
            return null;
        }
    }

    private readManifest(dir: string): BackupManifest | null {
        const file = path.join(dir, "manifest.json");
        if (!fs.existsSync(file)) return null;
        try {
            return JSON.parse(fs.readFileSync(file, "utf8"));
        } catch {
            return null;
        }
    }

    private jsonSafe(value: unknown): unknown {
        if (typeof value === "bigint") return value.toString();
        if (value instanceof Date) return value.toISOString();
        if (Buffer.isBuffer(value)) return { $bytes: value.toString("base64") };
        if (Array.isArray(value)) return value.map((item) => this.jsonSafe(item));
        if (value && typeof value === "object") {
            const out: Record<string, unknown> = {};
            for (const [key, item] of Object.entries(value)) {
                out[key] = this.jsonSafe(item);
            }
            return out;
        }
        return value;
    }

    private fileBytes(file: string) {
        try {
            return fs.statSync(file).size;
        } catch {
            return 0;
        }
    }

    private dirBytes(dir: string) {
        let total = 0;
        const walk = (current: string) => {
            if (!fs.existsSync(current)) return;
            for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
                const next = path.join(current, entry.name);
                if (entry.isDirectory()) walk(next);
                else if (entry.isFile()) total += fs.statSync(next).size;
            }
        };
        walk(dir);
        return total;
    }
}
