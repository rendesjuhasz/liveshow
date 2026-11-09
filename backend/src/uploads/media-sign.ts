import { createHmac, timingSafeEqual } from "crypto";
import { streamSecret } from "../auth/secrets";

export const MEDIA_TTL_SEC = 3600;
const FILE_RE = /^[a-zA-Z0-9._-]{8,80}$/;
const KINDS = new Set(["avatars", "covers"]);

export function mediaKindAndFile(storedPath: string) {
    const raw = String(storedPath || "").split("?")[0];
    const match = raw.match(/^\/uploads\/(avatars|covers)\/([^/]+)$/);
    if (!match) return null;
    const kind = match[1];
    const file = match[2];
    if (!KINDS.has(kind) || !FILE_RE.test(file) || file.toLowerCase().endsWith(".svg")) return null;
    return { kind, file };
}

function sign(kind: string, file: string, exp: number) {
    return createHmac("sha256", streamSecret()).update(`${kind}:${file}:${exp}`).digest("hex");
}

function safeEq(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
}

export function signMediaPath(storedPath: string, ttlSec = MEDIA_TTL_SEC) {
    const parsed = mediaKindAndFile(storedPath);
    if (!parsed) return storedPath;
    const exp = Math.floor(Date.now() / 1000) + ttlSec;
    const sig = sign(parsed.kind, parsed.file, exp);
    return `/media/${parsed.kind}/${encodeURIComponent(parsed.file)}?e=${exp}&s=${sig}`;
}

export function verifyMediaSignature(kind: string, file: string, expRaw: string, sig: string) {
    if (!KINDS.has(kind) || !FILE_RE.test(file) || file.toLowerCase().endsWith(".svg")) return false;
    const exp = Number(expRaw);
    if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
    return safeEq(sign(kind, file, exp), String(sig || ""));
}

export function rewriteMediaUrls(value: unknown, depth = 0): unknown {
    if (depth > 8 || value == null) return value;
    if (typeof value === "string") {
        if (value.startsWith("/uploads/")) return signMediaPath(value);
        return value;
    }
    if (Array.isArray(value)) return value.map((item) => rewriteMediaUrls(item, depth + 1));
    if (typeof value !== "object") return value;
    if (value instanceof Date) return value;
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(obj)) {
        out[key] = rewriteMediaUrls(item, depth + 1);
    }
    return out;
}
