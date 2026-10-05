import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { publicFrontendUrl } from "./public-url";

export function jwtSecret() {
    const value = String(process.env.JWT_SECRET || "").trim();
    if (!value) {
        throw new Error("JWT_SECRET kötelező. Állítsd be a környezeti változót, fallback secret nincs.");
    }
    return value;
}

export function streamSecret() {
    const value = String(process.env.STREAM_SECRET || "").trim();
    if (!value) {
        throw new Error("STREAM_SECRET kötelező. Állítsd be a környezeti változót, fallback secret nincs.");
    }
    return value;
}

export function corsOrigins() {
    const extra = String(process.env.FRONTEND_URL || process.env.APP_URL || "")
        .split(",")
        .map((s) => s.trim().replace(/\/$/, ""))
        .filter(Boolean);
    const pub = publicFrontendUrl();
    const defaults = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        pub,
        pub.replace(/^https:\/\//, "http://"),
    ];
    return [...new Set([...defaults, ...extra])];
}

/** Devben a telefon LAN-originje is kell a Socket.IO-hoz. */
export function socketCorsOrigin(): true | string[] {
    if (process.env.NODE_ENV === "production") return corsOrigins();
    return true;
}

export function isDevPayAllowed() {
    if (process.env.NODE_ENV === "production") return false;
    const flag = String(process.env.ALLOW_DEV_PAY || "").trim().toLowerCase();
    if (flag === "true" || flag === "1" || flag === "yes") return true;
    if (flag === "false" || flag === "0" || flag === "no") return false;
    return true;
}

export function barionWebhookSecret() {
    return String(process.env.BARION_WEBHOOK_SECRET || "").trim();
}

export function barionIpAllowlist() {
    return String(process.env.BARION_IP_ALLOWLIST || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

export function barionConfigured() {
    return Boolean(process.env.BARION_POS_KEY?.trim() && process.env.BARION_PAYEE?.trim());
}

export function assertRequiredSecrets() {
    jwtSecret();
    streamSecret();
    if (process.env.NODE_ENV === "production") {
        if (!String(process.env.REDIS_URL || "").trim()) {
            throw new Error("REDIS_URL kötelező éles környezetben a rate limiterhez.");
        }
        if (barionConfigured() && !barionWebhookSecret() && barionIpAllowlist().length === 0) {
            throw new Error(
                "Barion élesben BARION_WEBHOOK_SECRET vagy BARION_IP_ALLOWLIST nélkül nem indulhat.",
            );
        }
    }
}

export function hmacHex(secret: string, value: string) {
    return createHmac("sha256", secret).update(value).digest("hex");
}

export function hashSecret(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

export function newOpaqueToken() {
    return randomBytes(32).toString("base64url");
}

export function safeEqualHex(a: string, b: string) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
}
