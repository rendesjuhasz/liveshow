const TOKEN_KEY = "token";
const CSRF_KEY = "ls_csrf";
const CSRF_COOKIE = "ls_csrf";
const LEGACY_TOKEN_COOKIE = "ls_token";

/** Opaque flag: access JWT lives in HttpOnly cookie, never in JS. */
export const COOKIE_SESSION = "cookie-session";

let memoryCsrf: string | null = null;

export class ApiError extends Error {
    status: number;

    constructor(message: string, status = 0) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

function readCookie(name: string) {
    if (typeof document === "undefined") return null;
    const parts = document.cookie.split("; ");
    for (const part of parts) {
        const i = part.indexOf("=");
        if (i === -1) continue;
        if (part.slice(0, i) === name) {
            try {
                return decodeURIComponent(part.slice(i + 1));
            } catch {
                return part.slice(i + 1);
            }
        }
    }
    return null;
}

function clearCookie(name: string) {
    if (typeof document === "undefined") return;
    document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0`;
}

function writeStore(storage: Storage | undefined, key: string, value: string | null) {
    if (!storage) return;
    try {
        if (value) storage.setItem(key, value);
        else storage.removeItem(key);
    } catch {
        /* privát mód */
    }
}

function wipeLegacyJwt() {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(TOKEN_KEY);
    } catch {
        /* ignore */
    }
    clearCookie(LEGACY_TOKEN_COOKIE);
}

export function getAuthToken() {
    wipeLegacyJwt();
    return null;
}

export function setAuthToken(_token: string) {
    wipeLegacyJwt();
}

export function clearAuthToken() {
    memoryCsrf = null;
    wipeLegacyJwt();
    if (typeof window === "undefined") return;
    writeStore(window.sessionStorage, CSRF_KEY, null);
}

export function setCsrfToken(token: string) {
    memoryCsrf = token;
    if (typeof window === "undefined") return;
    writeStore(window.sessionStorage, CSRF_KEY, token);
}

export function getCsrfToken() {
    if (typeof window === "undefined") return memoryCsrf;
    const fromCookie = readCookie(CSRF_COOKIE);
    if (fromCookie) {
        if (memoryCsrf !== fromCookie) {
            memoryCsrf = fromCookie;
            writeStore(window.sessionStorage, CSRF_KEY, fromCookie);
        }
        return fromCookie;
    }
    if (memoryCsrf) return memoryCsrf;
    try {
        memoryCsrf = window.sessionStorage.getItem(CSRF_KEY);
    } catch {
        memoryCsrf = null;
    }
    return memoryCsrf;
}

export function isCsrfFailure(err: unknown, data?: { message?: unknown }) {
    const raw = data?.message ?? (err && typeof err === "object" && "message" in err ? (err as Error).message : "");
    const message = Array.isArray(raw) ? raw.join(" ") : String(raw || "");
    return message.toLowerCase().includes("csrf");
}

export function tokenExpiresAt(_token: string | null): number | null {
    return null;
}

export function isTokenExpired(_token: string | null, _skewSec = 60) {
    return false;
}

export function isUnauthorizedError(err: unknown) {
    if (err instanceof ApiError) {
        return err.status === 401;
    }
    return false;
}
