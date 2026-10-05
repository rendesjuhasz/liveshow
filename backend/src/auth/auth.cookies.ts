import type { CookieOptions, Request, Response } from "express";
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE, isHttpsRequest } from "../security/http-guard";

const ACCESS_MS = 60 * 60 * 1000;
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const CSRF_MS = 7 * 24 * 60 * 60 * 1000;

function base(req: Request, httpOnly: boolean, maxAge: number): CookieOptions {
    return {
        httpOnly,
        secure: isHttpsRequest(req),
        sameSite: "lax",
        path: "/",
        maxAge,
    };
}

export function setCsrfCookie(req: Request, res: Response, csrfToken: string) {
    res.cookie(CSRF_COOKIE, csrfToken, base(req, false, CSRF_MS));
}

export function setAuthCookies(
    req: Request,
    res: Response,
    payload: { token: string; refreshToken: string; csrfToken: string },
) {
    res.cookie(ACCESS_COOKIE, payload.token, base(req, true, ACCESS_MS));
    res.cookie(REFRESH_COOKIE, payload.refreshToken, base(req, true, REFRESH_MS));
    setCsrfCookie(req, res, payload.csrfToken);
}

export function clearAuthCookies(req: Request, res: Response) {
    res.cookie(ACCESS_COOKIE, "", { ...base(req, true, 0), maxAge: 0 });
    res.cookie(REFRESH_COOKIE, "", { ...base(req, true, 0), maxAge: 0 });
    res.cookie(CSRF_COOKIE, "", { ...base(req, false, 0), maxAge: 0 });
}

export function readCookie(req: Request, name: string) {
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

export { ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE };
