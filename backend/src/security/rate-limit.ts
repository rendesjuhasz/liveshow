import { BadRequestException, HttpException, HttpStatus } from "@nestjs/common";
import Redis from "ioredis";

const hits = new Map<string, number[]>();
let redis: Redis | null | undefined;

function redisUrl() {
    return String(process.env.REDIS_URL || "").trim();
}

function getRedis() {
    const url = redisUrl();
    if (!url) return null;
    if (redis === undefined) {
        redis = new Redis(url, {
            maxRetriesPerRequest: 2,
            enableReadyCheck: true,
            lazyConnect: true,
        });
        redis.on("error", () => undefined);
    }
    return redis;
}

export async function pingRateLimitStore() {
    if (process.env.NODE_ENV !== "production") return;
    const client = getRedis();
    if (!client) {
        throw new Error("REDIS_URL kötelező éles környezetben.");
    }
    if (client.status === "wait") {
        await client.connect();
    }
    const pong = await client.ping();
    if (String(pong).toUpperCase() !== "PONG") {
        throw new Error("A Redis rate limiter nem elérhető.");
    }
}

async function hitRedis(key: string, max: number, windowMs: number) {
    const client = getRedis();
    if (!client) return false;
    if (client.status === "wait") {
        await client.connect();
    }
    const bucket = Math.floor(Date.now() / windowMs);
    const redisKey = `rl:${key}:${bucket}`;
    const n = await client.incr(redisKey);
    if (n === 1) {
        await client.pexpire(redisKey, windowMs);
    }
    if (n > max) {
        throw new HttpException("Túl sok kérés. Próbáld újra később.", HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
}

function hitMemory(key: string, max: number, windowMs: number) {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
        throw new HttpException("Túl sok kérés. Próbáld újra később.", HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    hits.set(key, recent);
}

export async function assertRateLimit(key: string, max: number, windowMs: number) {
    try {
        const used = await hitRedis(key, max, windowMs);
        if (used) return;
    } catch (err) {
        if (err instanceof HttpException) throw err;
        if (process.env.NODE_ENV === "production") {
            throw new HttpException("A rate limiter nem elérhető.", HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
    hitMemory(key, max, windowMs);
}

export const HLS_VIEWER_MAX_PER_MIN = 900;
export const HLS_IP_ABUSE_MAX_PER_MIN = 12_000;

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertValidEmail(email: string) {
    if (!EMAIL_RE.test(email) || email.length > 190) {
        throw new BadRequestException("Érvényes email cím szükséges.");
    }
}

export function assertValidPassword(password: string) {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        throw new BadRequestException(`A jelszó legalább ${MIN_PASSWORD_LENGTH} karakter legyen.`);
    }
}

type ReqLike = {
    ip?: string;
    headers?: Record<string, unknown>;
    socket?: { remoteAddress?: string };
    query?: Record<string, unknown>;
    method?: string;
    originalUrl?: string;
    path?: string;
};

export function trustProxyEnabled() {
    if (String(process.env.TRUST_PROXY || "").toLowerCase() === "true") return true;
    return process.env.NODE_ENV === "production";
}

export function clientKey(req: ReqLike) {
    if (trustProxyEnabled()) {
        const xf = req.headers?.["x-forwarded-for"];
        const forwarded = Array.isArray(xf) ? xf[0] : String(xf || "");
        const first = forwarded.split(",")[0].trim();
        if (first) return first;
    }
    return String(req.ip || req.socket?.remoteAddress || "unknown").trim();
}

export function requestQueryParam(req: ReqLike, name: string) {
    const fromQuery = req.query?.[name];
    if (Array.isArray(fromQuery)) {
        const first = fromQuery[0];
        if (first != null && String(first).trim()) return String(first).trim();
    } else if (fromQuery != null && String(fromQuery).trim()) {
        return String(fromQuery).trim();
    }
    const raw = String(req.originalUrl || req.path || "");
    const q = raw.indexOf("?");
    if (q < 0) return "";
    try {
        return new URLSearchParams(raw.slice(q + 1)).get(name)?.trim() || "";
    } catch {
        return "";
    }
}

export function hlsViewerKey(req: ReqLike) {
    const userId = requestQueryParam(req, "userId");
    if (userId) return `user:${userId}`;
    const token = requestQueryParam(req, "token");
    if (token) return `tok:${token.slice(0, 24)}`;
    return `anon:${clientKey(req)}`;
}

export async function applyGlobalRateLimit(req: ReqLike) {
    const method = String(req.method || "GET").toUpperCase();
    if (method === "OPTIONS") return;
    const path = String(req.originalUrl || req.path || "");
    if (path === "/health" || path.startsWith("/health/")) return;
    if (path.startsWith("/socket.io") || path.startsWith("/live-io")) return;
    if (path.startsWith("/live-preview")) return;
    const ip = clientKey(req);
    if (path.startsWith("/output/") || path.includes("/stream/")) {
        await assertRateLimit(`hls:viewer:${hlsViewerKey(req)}`, HLS_VIEWER_MAX_PER_MIN, 60_000);
        await assertRateLimit(`hls:ip:${ip}`, HLS_IP_ABUSE_MAX_PER_MIN, 60_000);
        return;
    }
    await assertRateLimit(`ip:${ip}`, 180, 60_000);
}
