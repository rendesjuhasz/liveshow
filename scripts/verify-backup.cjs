#!/usr/bin/env node
/**
 * Read-only check of a LiveShow backup snapshot folder.
 * Usage: node scripts/verify-backup.cjs backend/backups/<snapshot-id>
 * Does not touch PostgreSQL.
 */
const fs = require("fs");
const path = require("path");

const dir = process.argv[2];
if (!dir) {
    console.error("Usage: node scripts/verify-backup.cjs <snapshot-dir>");
    process.exit(2);
}

function isNonEmptyFile(file) {
    try {
        return fs.existsSync(file) && fs.statSync(file).isFile() && fs.statSync(file).size > 0;
    } catch {
        return false;
    }
}

const abs = path.resolve(dir);
const errors = [];
const warnings = [];
if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    console.error(JSON.stringify({ ok: false, errors: ["snapshot dir missing"] }, null, 2));
    process.exit(1);
}

const dump = path.join(abs, "database", "postgres.dump");
const dumpBytes = isNonEmptyFile(dump) ? fs.statSync(dump).size : 0;
const dbDir = path.join(abs, "database");
let jsonTables = 0;
if (fs.existsSync(dbDir)) {
    jsonTables = fs.readdirSync(dbDir).filter((n) => n.endsWith(".json") && n !== "tables.json").length;
}
let method = "none";
if (dumpBytes >= 64) method = "pg_dump";
else if (jsonTables > 0 || isNonEmptyFile(path.join(dbDir, "tables.json"))) method = "json-fallback";

if (!isNonEmptyFile(path.join(abs, "manifest.json"))) errors.push("manifest.json missing");
if (method === "none") errors.push("no postgres.dump and no JSON tables");
if (method === "json-fallback") warnings.push("JSON fallback — see docs/restore-test.md");
if (!isNonEmptyFile(path.join(abs, "config", "schema.prisma"))) errors.push("schema.prisma missing");
if (!isNonEmptyFile(path.join(abs, "RESTORE.txt"))) warnings.push("RESTORE.txt missing");
if (!isNonEmptyFile(path.join(abs, "config", "backend.env"))) warnings.push("backend.env missing");

const ok = errors.length === 0;
const result = { ok, method, dumpBytes, jsonTables, errors, warnings, dir: abs };
console.log(JSON.stringify(result, null, 2));
process.exit(ok ? 0 : 1);
