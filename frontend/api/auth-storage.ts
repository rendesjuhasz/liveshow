const TOKEN_KEY = "token";
const TOKEN_COOKIE = "ls_token";

let memoryToken: string | null = null;

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

function writeCookie(name: string, value: string) {
    if (typeof document === "undefined") return;
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
}

function clearCookie(name: string) {
    if (typeof document === "undefined") return;
    document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0`;
}

function readStore(storage: Storage | undefined) {
    if (!storage) return null;
    try {
        return storage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

function writeStore(storage: Storage | undefined, value: string | null) {
    if (!storage) return;
    try {
        if (value) storage.setItem(TOKEN_KEY, value);
        else storage.removeItem(TOKEN_KEY);
    } catch {
        /* privát mód */
    }
}

export function getAuthToken() {
    if (memoryToken) return memoryToken;
    if (typeof window === "undefined") return null;
    memoryToken =
        readStore(window.sessionStorage) ||
        readStore(window.localStorage) ||
        readCookie(TOKEN_COOKIE);
    return memoryToken;
}

export function setAuthToken(token: string) {
    memoryToken = token;
    if (typeof window === "undefined") return;
    writeStore(window.sessionStorage, token);
    writeStore(window.localStorage, token);
    try {
        writeCookie(TOKEN_COOKIE, token);
    } catch {
        /* ignore */
    }
}

export function clearAuthToken() {
    memoryToken = null;
    if (typeof window === "undefined") return;
    writeStore(window.sessionStorage, null);
    writeStore(window.localStorage, null);
    try {
        clearCookie(TOKEN_COOKIE);
    } catch {
        /* ignore */
    }
}

export function isUnauthorizedError(err: unknown) {
    if (err instanceof ApiError) {
        return err.status === 401 || err.status === 403;
    }
    return false;
}
