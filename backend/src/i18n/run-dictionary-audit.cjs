const { readdirSync, readFileSync, statSync } = require("fs");
const { extname, join } = require("path");

const LOCALES = ["hu", "en", "de", "it", "es", "fr"];
const KEY_CALL_RE = /\b(?:t|translate)\(\s*["'`]([a-zA-Z][\w.-]*)["'`]/g;
const SKIP_DIR = new Set(["node_modules", "dist", ".next", "coverage", "uploads", ".git", ".cursor"]);

function extractPlaceholders(value) {
    return [...String(value || "").matchAll(/\{[a-zA-Z0-9_]+\}/g)].map((m) => m[0]).sort();
}

function walkFiles(root, files = []) {
    let entries = [];
    try {
        entries = readdirSync(root);
    } catch {
        return files;
    }
    for (const name of entries) {
        if (SKIP_DIR.has(name)) continue;
        const full = join(root, name);
        let st;
        try {
            st = statSync(full);
        } catch {
            continue;
        }
        if (st.isDirectory()) walkFiles(full, files);
        else if (/\.(ts|tsx|js|jsx)$/.test(extname(name))) files.push(full);
    }
    return files;
}

function usedKeys(roots) {
    const keys = new Set();
    for (const root of roots) {
        for (const file of walkFiles(root)) {
            const norm = file.replace(/\\/g, "/");
            if (norm.endsWith(".spec.ts") || norm.endsWith(".spec.tsx")) continue;
            if (norm.endsWith("/i18n/messages.ts") || norm.endsWith("/lib/i18n/messages.ts")) continue;
            const src = readFileSync(file, "utf8");
            KEY_CALL_RE.lastIndex = 0;
            let match;
            while ((match = KEY_CALL_RE.exec(src))) keys.add(match[1]);
        }
    }
    return keys;
}

function parseJsString(src, start) {
    const quote = src[start];
    if (quote !== '"' && quote !== "'" && quote !== "`") return null;
    let i = start + 1;
    let value = "";
    while (i < src.length) {
        const ch = src[i];
        if (ch === "\\") {
            value += src[i + 1] ?? "";
            i += 2;
            continue;
        }
        if (ch === quote) return { value, next: i + 1 };
        value += ch;
        i += 1;
    }
    return null;
}

function parseMessageFile(file) {
    const src = readFileSync(file, "utf8");
    const keys = new Set();
    const rows = {};
    const keyRe = /["']([a-zA-Z][\w.-]*)["']\s*:\s*row\s*\(/g;
    let match;
    while ((match = keyRe.exec(src))) {
        const key = match[1];
        keys.add(key);
        let i = match.index + match[0].length;
        const values = [];
        while (i < src.length && values.length < LOCALES.length) {
            const ch = src[i];
            if (ch === ")") break;
            if (/\s/.test(ch) || ch === ",") {
                i += 1;
                continue;
            }
            const parsed = parseJsString(src, i);
            if (!parsed) break;
            values.push(parsed.value);
            i = parsed.next;
        }
        const row = {};
        LOCALES.forEach((loc, idx) => {
            row[loc] = values[idx] ?? "";
        });
        rows[key] = row;
    }
    return { keys, rows };
}

function cellIssues(rows) {
    const missingOrEmpty = [];
    const placeholderMismatch = [];
    for (const [key, row] of Object.entries(rows)) {
        const sets = [];
        for (const loc of LOCALES) {
            const value = String(row?.[loc] ?? "").trim();
            if (!value) missingOrEmpty.push(`${key} [${loc}]`);
            sets.push(extractPlaceholders(value).join(","));
        }
        if (sets.some((item) => item !== sets[0])) placeholderMismatch.push(key);
    }
    return { missingOrEmpty, placeholderMismatch };
}

const repo = join(__dirname, "../../..");
const backendSrc = join(repo, "backend/src");
const frontend = join(repo, "frontend");
const backendDict = parseMessageFile(join(backendSrc, "i18n/messages.ts"));
const frontendDict = parseMessageFile(join(frontend, "lib/i18n/messages.ts"));
const backendUsed = usedKeys([backendSrc]);
const frontendUsed = usedKeys([
    join(frontend, "app"),
    join(frontend, "components"),
    join(frontend, "lib"),
    join(frontend, "context"),
    join(frontend, "api"),
]);

const report = {
    backendMissing: [...backendUsed].filter((k) => !backendDict.keys.has(k)).sort(),
    frontendMissing: [...frontendUsed].filter((k) => !frontendDict.keys.has(k)).sort(),
    backendCells: cellIssues(backendDict.rows),
    frontendCells: cellIssues(frontendDict.rows),
};

console.log(JSON.stringify(report, null, 2));
const failed =
    report.backendMissing.length +
    report.frontendMissing.length +
    report.backendCells.missingOrEmpty.length +
    report.frontendCells.missingOrEmpty.length +
    report.backendCells.placeholderMismatch.length +
    report.frontendCells.placeholderMismatch.length;
process.exit(failed ? 1 : 0);
