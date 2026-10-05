import * as fs from "fs";
import * as path from "path";

export type SnapshotVerify = {
    ok: boolean;
    method: "pg_dump" | "json-fallback" | "none";
    errors: string[];
    warnings: string[];
    dumpBytes: number;
    jsonTables: number;
    hasManifest: boolean;
    hasRestoreTxt: boolean;
    hasBackendEnv: boolean;
    hasSchema: boolean;
};

function isNonEmptyFile(file: string) {
    try {
        return fs.existsSync(file) && fs.statSync(file).isFile() && fs.statSync(file).size > 0;
    } catch {
        return false;
    }
}

export function verifyBackupSnapshot(snapshotDir: string): SnapshotVerify {
    const errors: string[] = [];
    const warnings: string[] = [];
    const dir = path.resolve(snapshotDir);

    const empty = (extra: string[]): SnapshotVerify => ({
        ok: false,
        method: "none",
        errors: extra,
        warnings,
        dumpBytes: 0,
        jsonTables: 0,
        hasManifest: false,
        hasRestoreTxt: false,
        hasBackendEnv: false,
        hasSchema: false,
    });

    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return empty(["A snapshot mappa nem található."]);
    }

    const hasManifest = isNonEmptyFile(path.join(dir, "manifest.json"));
    if (!hasManifest) errors.push("Hiányzik a manifest.json.");
    else {
        try {
            const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
            if (manifest?.ok === false) errors.push("A manifest.ok=false (valamelyik rész sikertelen).");
        } catch {
            errors.push("A manifest.json nem érvényes JSON.");
        }
    }

    const hasRestoreTxt = isNonEmptyFile(path.join(dir, "RESTORE.txt"));
    if (!hasRestoreTxt) warnings.push("Hiányzik a RESTORE.txt.");

    const dumpFile = path.join(dir, "database", "postgres.dump");
    const dumpBytes = isNonEmptyFile(dumpFile) ? fs.statSync(dumpFile).size : 0;
    const dbDir = path.join(dir, "database");
    let jsonTables = 0;
    if (fs.existsSync(dbDir)) {
        jsonTables = fs
            .readdirSync(dbDir)
            .filter((name) => name.endsWith(".json") && name !== "tables.json").length;
    }
    const hasTablesIndex = isNonEmptyFile(path.join(dbDir, "tables.json"));

    let method: SnapshotVerify["method"] = "none";
    if (dumpBytes >= 64) method = "pg_dump";
    else if (hasTablesIndex || jsonTables > 0) method = "json-fallback";

    if (method === "none") errors.push("Nincs postgres.dump (≥64 B) és nincs JSON táblaexport.");
    if (method === "json-fallback") {
        warnings.push(
            "JSON fallback: nincs egygombos pg_restore. Telepítsd a pg_dump-ot, majd docs/restore-test.md.",
        );
    }

    const hasBackendEnv = isNonEmptyFile(path.join(dir, "config", "backend.env"));
    const hasSchema = isNonEmptyFile(path.join(dir, "config", "schema.prisma"));
    if (!hasBackendEnv) warnings.push("Nincs config/backend.env — titkok csak akkor vannak meg, ha máshol tárolod.");
    if (!hasSchema) errors.push("Hiányzik a config/schema.prisma.");

    return {
        ok: errors.length === 0,
        method,
        errors,
        warnings,
        dumpBytes,
        jsonTables,
        hasManifest,
        hasRestoreTxt,
        hasBackendEnv,
        hasSchema,
    };
}

export function isBackupDirOnAppVolume(backupRoot: string, appCwd: string) {
    const root = path.resolve(backupRoot);
    const cwd = path.resolve(appCwd);
    const rel = path.relative(cwd, root);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
