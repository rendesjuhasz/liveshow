import { readdirSync, readFileSync, statSync } from "fs";
import { extname, join } from "path";
import { LOCALES, MESSAGES } from "./messages";

const KEY_CALL_RE = /\b(?:t|translate)\(\s*["'`]([a-zA-Z][\w.-]*)["'`]/g;
const SKIP_DIR = new Set([
    "node_modules",
    "dist",
    ".next",
    "coverage",
    "uploads",
    ".git",
    ".cursor",
    "terminals",
    "agent-transcripts",
]);

export function extractPlaceholders(value: string) {
    return [...String(value || "").matchAll(/\{[a-zA-Z0-9_]+\}/g)].map((m) => m[0]).sort();
}

export function walkFiles(root: string, files: string[] = []) {
    let entries: string[] = [];
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

export function usedTranslationKeys(roots: string[], ignoreFile?: (file: string) => boolean) {
    const keys = new Set<string>();
    const byFile = new Map<string, string[]>();
    for (const root of roots) {
        for (const file of walkFiles(root)) {
            if (ignoreFile?.(file)) continue;
            const norm = file.replace(/\\/g, "/");
            if (norm.endsWith(".spec.ts") || norm.endsWith(".spec.tsx")) continue;
            if (norm.endsWith("/i18n/messages.ts")) continue;
            if (norm.endsWith("/lib/i18n/messages.ts")) continue;
            const src = readFileSync(file, "utf8");
            const found: string[] = [];
            KEY_CALL_RE.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = KEY_CALL_RE.exec(src))) {
                found.push(match[1]);
                keys.add(match[1]);
            }
            if (found.length) byFile.set(file, found);
        }
    }
    return { keys, byFile };
}

export function dictionaryCellIssues(
    messages: Record<string, Record<string, string>>,
    locales: readonly string[] = LOCALES,
) {
    const missingOrEmpty: string[] = [];
    const placeholderMismatch: string[] = [];
    for (const [key, row] of Object.entries(messages)) {
        const sets: string[] = [];
        for (const loc of locales) {
            const value = String(row?.[loc] ?? "").trim();
            if (!value) missingOrEmpty.push(`${key} [${loc}]`);
            sets.push(extractPlaceholders(value).join(","));
        }
        if (sets.some((item) => item !== sets[0])) placeholderMismatch.push(key);
    }
    return { missingOrEmpty, placeholderMismatch };
}

function parseJsString(src: string, start: number): { value: string; next: number } | null {
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

/** Parse `"key": row("hu", "en", ...)` entries, including multiline row() calls. */
export function parseMessageFile(file: string) {
    const src = readFileSync(file, "utf8");
    const keys = new Set<string>();
    const rows: Record<string, Record<string, string>> = {};
    const keyRe = /["']([a-zA-Z][\w.-]*)["']\s*:\s*row\s*\(/g;
    let match: RegExpExecArray | null;
    while ((match = keyRe.exec(src))) {
        const key = match[1];
        keys.add(key);
        let i = match.index + match[0].length;
        const values: string[] = [];
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
        const row: Record<string, string> = {};
        LOCALES.forEach((loc, idx) => {
            row[loc] = values[idx] ?? "";
        });
        rows[key] = row;
    }
    return { keys, rows };
}

export function auditDictionaries(opts: {
    backendRoot: string;
    frontendRoots: string[];
    frontendMessages: string;
}) {
    const backendUsed = usedTranslationKeys([opts.backendRoot]);
    const frontendUsed = usedTranslationKeys(opts.frontendRoots);
    const frontendDict = parseMessageFile(opts.frontendMessages);
    const backendMissing = [...backendUsed.keys].filter((key) => !MESSAGES[key]).sort();
    const frontendMissing = [...frontendUsed.keys].filter((key) => !frontendDict.keys.has(key)).sort();
    const backendCells = dictionaryCellIssues(MESSAGES);
    const frontendCells = dictionaryCellIssues(frontendDict.rows);
    return {
        backendMissing,
        frontendMissing,
        backendCells,
        frontendCells,
        frontendKeyCount: frontendDict.keys.size,
        backendKeyCount: Object.keys(MESSAGES).length,
    };
}
