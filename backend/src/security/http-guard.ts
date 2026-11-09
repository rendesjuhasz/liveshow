import { ForbiddenException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { corsOrigins } from "../auth/secrets";
import { applyGlobalRateLimit } from "./rate-limit";

export const CSRF_COOKIE = "ls_csrf";
export const REFRESH_COOKIE = "ls_refresh";
export const ACCESS_COOKIE = "ls_access";
export const HLS_COOKIE = "ls_hls";
export const CSRF_HEADER = "x-csrf-token";

const SKIP_CSRF = [
    "/auth/login",
    "/auth/register",
    "/auth/register-streamer",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "/auth/resend-verification",
    "/auth/refresh",
    "/auth/oauth",
    "/api/barion",
    "/payments/stripe/webhook",
    "/socket.io",
    "/live-io",
    "/i18n/missing",
];

function cookieValue(req: Request, name: string) {
    const raw = String(req.headers.cookie || "");
    for (const part of raw.split(";")) {
        const i = part.indexOf("=");
        if (i === -1) continue;
        if (part.slice(0, i).trim() === name) {
            try {
                return decodeURIComponent(part.slice(i + 1).trim());
            } catch {
                return part.slice(i + 1).trim();
            }
        }
    }
    return "";
}

function pathOf(req: Request) {
    return String(req.originalUrl || req.path || "").split("?")[0];
}

function skipCsrf(path: string) {
    return SKIP_CSRF.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

function originAllowed(origin: string) {
    if (!origin) return false;
    try {
        const host = new URL(origin).hostname;
        if (host === "localhost" || host === "127.0.0.1") return true;
        if (host.endsWith(".trycloudflare.com")) return true;
        if (/^(10|127)\./.test(host)) return true;
        if (/^192\.168\./.test(host)) return true;
        if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    } catch {
        return false;
    }
    return corsOrigins().some((allowed) => origin === allowed || origin.startsWith(`${allowed}/`));
}

export function securityMiddleware(req: Request, res: Response, next: NextFunction) {
    void (async () => {
        try {
            await applyGlobalRateLimit(req);
        } catch (err) {
            next(err);
            return;
        }

        const method = String(req.method || "GET").toUpperCase();
        const path = pathOf(req);
        const origin = String(req.headers.origin || "");

        if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && origin && !originAllowed(origin)) {
            if (process.env.NODE_ENV === "production" && !skipCsrf(path)) {
                next(new ForbiddenException("Ismeretlen origin."));
                return;
            }
        }

        if (!["POST", "PUT", "PATCH", "DELETE"].includes(method) || skipCsrf(path)) {
            next();
            return;
        }

        const cookie = cookieValue(req, CSRF_COOKIE);
        const header = String(req.headers[CSRF_HEADER] || "");
        if (!cookie || !header || cookie !== header) {
            next(new ForbiddenException("Érvénytelen CSRF token."));
            return;
        }
        next();
    })();
}

function headerValue(req: { headers?: Record<string, unknown> }, name: string) {
    const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
    if (Array.isArray(raw)) return String(raw[0] ?? "");
    return String(raw ?? "");
}

function hostnameOf(value: string) {
    const first = value.split(",")[0].trim();
    if (!first) return "";
    try {
        if (first.includes("://")) return new URL(first).hostname.toLowerCase();
    } catch {
        /* fall through */
    }
    return first.split(":")[0].toLowerCase();
}

function isPublicHttpsTunnelHost(host: string) {
    return (
        host === "streamtest.hu" ||
        host.endsWith(".streamtest.hu") ||
        host.endsWith(".trycloudflare.com") ||
        host.endsWith(".ngrok-free.app") ||
        host.endsWith(".ngrok.app") ||
        host.endsWith(".ngrok.io") ||
        host.endsWith(".loca.lt")
    );
}

/** Nest often sees HTTP (Next rewrite to :3200) while the browser is on HTTPS (Cloudflare). */
export function isHttpsRequest(req: { headers?: Record<string, unknown> }) {
    const origin = headerValue(req, "origin") || headerValue(req, "referer");
    if (origin.toLowerCase().startsWith("https://")) return true;
    const proto = headerValue(req, "x-forwarded-proto")
        .split(",")
        .map((p) => p.trim().toLowerCase());
    if (proto.includes("https")) return true;
    const cfVisitor = headerValue(req, "cf-visitor").toLowerCase();
    if (cfVisitor.includes("https")) return true;
    if (headerValue(req, "x-forwarded-ssl").toLowerCase() === "on") return true;
    const hosts = [
        headerValue(req, "x-liveshow-client-host"),
        headerValue(req, "x-forwarded-host"),
        headerValue(req, "host"),
        origin,
    ].map(hostnameOf);
    if (hosts.some(isPublicHttpsTunnelHost)) return true;
    return process.env.NODE_ENV === "production";
}
