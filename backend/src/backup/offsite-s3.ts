import * as fs from "fs";
import * as path from "path";
import { S3Client, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

export type OffsiteResult = {
    ok: boolean;
    skipped: boolean;
    provider: string;
    bucket: string | null;
    prefix: string;
    region: string;
    endpoint: string | null;
    files: number;
    bytes: number;
    verified: number;
    deleted: number;
    errors: string[];
    finishedAt: string;
};

export type OffsitePublicStatus = {
    configured: boolean;
    enabled: boolean;
    required: boolean;
    provider: string;
    bucket: string | null;
    prefix: string;
    region: string;
    endpoint: string | null;
    keepDays: number;
    pathStyle: boolean;
};

function env(name: string) {
    return String(process.env[name] || "").trim();
}

function flag(name: string, fallback: boolean) {
    const raw = env(name).toLowerCase();
    if (!raw) return fallback;
    if (["false", "0", "off", "no"].includes(raw)) return false;
    if (["true", "1", "on", "yes"].includes(raw)) return true;
    return fallback;
}

function detectProvider(endpoint: string) {
    const e = endpoint.toLowerCase();
    if (e.includes("backblazeb2.com") || e.includes("backblaze")) return "backblaze-b2";
    if (e.includes("wasabisys.com") || e.includes("wasabi")) return "wasabi";
    if (e.includes("amazonaws.com") || !e) return "aws-s3";
    return "s3-compatible";
}

export function offsiteKeepDays() {
    const days = Number(process.env.BACKUP_OFFSITE_KEEP_DAYS || process.env.BACKUP_KEEP_DAYS || 14);
    return Number.isFinite(days) && days >= 1 ? Math.min(365, Math.floor(days)) : 14;
}

export function offsitePublicStatus(): OffsitePublicStatus {
    const endpoint = env("BACKUP_S3_ENDPOINT") || null;
    const bucket = env("BACKUP_S3_BUCKET") || null;
    const configured = Boolean(bucket && env("BACKUP_S3_ACCESS_KEY") && env("BACKUP_S3_SECRET_KEY"));
    return {
        configured,
        enabled: configured && flag("BACKUP_OFFSITE_ENABLED", true),
        required: flag("BACKUP_OFFSITE_REQUIRED", process.env.NODE_ENV === "production"),
        provider: detectProvider(endpoint || ""),
        bucket,
        prefix: (env("BACKUP_S3_PREFIX") || "liveshow").replace(/^\/+|\/+$/g, ""),
        region: env("BACKUP_S3_REGION") || "us-east-1",
        endpoint,
        keepDays: offsiteKeepDays(),
        pathStyle: endpoint ? flag("BACKUP_S3_FORCE_PATH_STYLE", true) : flag("BACKUP_S3_FORCE_PATH_STYLE", false),
    };
}

function client() {
    const st = offsitePublicStatus();
    if (!st.configured) return null;
    return new S3Client({
        region: st.region,
        endpoint: st.endpoint || undefined,
        forcePathStyle: st.pathStyle,
        credentials: {
            accessKeyId: env("BACKUP_S3_ACCESS_KEY"),
            secretAccessKey: env("BACKUP_S3_SECRET_KEY"),
        },
    });
}

function objectKey(prefix: string, snapshotId: string, rel: string) {
    const safeRel = rel.split(path.sep).join("/");
    return [prefix, snapshotId, safeRel].filter(Boolean).join("/");
}

function listLocalFiles(root: string) {
    const files: { abs: string; rel: string; bytes: number }[] = [];
    const walk = (dir: string, rel: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const nextAbs = path.join(dir, entry.name);
            const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(nextAbs, nextRel);
            else if (entry.isFile()) {
                files.push({ abs: nextAbs, rel: nextRel.replace(/\\/g, "/"), bytes: fs.statSync(nextAbs).size });
            }
        }
    };
    walk(root, "");
    return files;
}

export function parseSnapshotStamp(id: string) {
    const m = String(id).match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d+)Z$/);
    if (!m) return 0;
    const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
}

export async function uploadAndVerifySnapshot(snapshotDir: string, snapshotId: string): Promise<OffsiteResult> {
    const st = offsitePublicStatus();
    const finished = () => new Date().toISOString();
    const base: OffsiteResult = {
        ok: false,
        skipped: !st.enabled,
        provider: st.provider,
        bucket: st.bucket,
        prefix: st.prefix,
        region: st.region,
        endpoint: st.endpoint,
        files: 0,
        bytes: 0,
        verified: 0,
        deleted: 0,
        errors: [],
        finishedAt: finished(),
    };
    if (!st.enabled) {
        base.ok = true;
        base.skipped = true;
        return base;
    }
    const s3 = client();
    if (!s3 || !st.bucket) {
        base.errors.push("Offsite nincs konfigurálva (BACKUP_S3_BUCKET / ACCESS_KEY / SECRET_KEY).");
        base.finishedAt = finished();
        return base;
    }

    const files = listLocalFiles(snapshotDir);
    if (!files.length) {
        base.errors.push("A snapshot mappa üres, nincs mit feltölteni.");
        base.finishedAt = finished();
        return base;
    }

    for (const file of files) {
        try {
            const upload = new Upload({
                client: s3,
                params: {
                    Bucket: st.bucket,
                    Key: objectKey(st.prefix, snapshotId, file.rel),
                    Body: fs.createReadStream(file.abs),
                    ContentLength: file.bytes,
                },
                queueSize: 2,
                partSize: 8 * 1024 * 1024,
            });
            await upload.done();
            base.files += 1;
            base.bytes += file.bytes;
        } catch (err: any) {
            base.errors.push(`${file.rel}: ${err?.message || "feltöltés sikertelen"}`);
        }
    }

    for (const file of files) {
        const key = objectKey(st.prefix, snapshotId, file.rel);
        try {
            const head = await s3.send(new HeadObjectCommand({ Bucket: st.bucket, Key: key }));
            const remote = Number(head.ContentLength || 0);
            if (remote !== file.bytes) {
                base.errors.push(`${file.rel}: méret eltér (helyi ${file.bytes}, remote ${remote})`);
            } else {
                base.verified += 1;
            }
        } catch (err: any) {
            base.errors.push(`${file.rel}: HeadObject ${err?.message || "sikertelen"}`);
        }
    }

    if (!files.some((f) => f.rel === "manifest.json")) {
        base.errors.push("Remote ellenőrizve, de helyi manifest.json hiányzik.");
    }
    if (!files.some((f) => f.rel === "database/postgres.dump" || f.rel === "database/tables.json")) {
        base.errors.push("Nincs postgres.dump és tables.json a feltöltött snapshotban.");
    }

    base.ok = base.errors.length === 0 && base.verified === files.length && base.files === files.length;
    base.finishedAt = finished();
    return base;
}

export async function pruneOffsiteSnapshots(): Promise<{ deleted: number; errors: string[] }> {
    const st = offsitePublicStatus();
    const s3 = client();
    const errors: string[] = [];
    let deleted = 0;
    if (!st.enabled || !s3 || !st.bucket) return { deleted: 0, errors };
    const cutoff = Date.now() - offsiteKeepDays() * 24 * 60 * 60 * 1000;
    const prefix = `${st.prefix}/`.replace(/\/+$/, "/") ;
    const ids = new Set<string>();
    let token: string | undefined;
    try {
        do {
            const page = await s3.send(
                new ListObjectsV2Command({
                    Bucket: st.bucket,
                    Prefix: prefix,
                    Delimiter: "/",
                    ContinuationToken: token,
                }),
            );
            for (const p of page.CommonPrefixes || []) {
                const raw = String(p.Prefix || "").slice(prefix.length).replace(/\/$/, "");
                if (raw) ids.add(raw);
            }
            token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);
    } catch (err: any) {
        return { deleted: 0, errors: [err?.message || "Offsite lista sikertelen"] };
    }

    for (const id of ids) {
        const t = parseSnapshotStamp(id);
        if (!t || t >= cutoff) continue;
        deleted += await deletePrefix(s3, st.bucket, `${prefix}${id}/`, errors);
    }
    return { deleted, errors };
}

async function deletePrefix(s3: S3Client, bucket: string, prefix: string, errors: string[]) {
    let deleted = 0;
    let token: string | undefined;
    do {
        const page = await s3.send(
            new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
        );
        const objects = (page.Contents || []).map((o) => ({ Key: o.Key })).filter((o) => o.Key);
        if (objects.length) {
            try {
                const res = await s3.send(
                    new DeleteObjectsCommand({
                        Bucket: bucket,
                        Delete: { Objects: objects, Quiet: true },
                    }),
                );
                deleted += objects.length - (res.Errors?.length || 0);
                for (const fail of res.Errors || []) {
                    errors.push(`${fail.Key}: ${fail.Message || "törlés sikertelen"}`);
                }
            } catch (err: any) {
                errors.push(err?.message || "DeleteObjects sikertelen");
            }
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return deleted;
}
