import {
    ApiError,
    getCsrfToken,
    isCsrfFailure,
    setCsrfToken,
} from "./auth-storage";
import { FALLBACK_GUEST_LOCALE, isLocale, translate } from "@/lib/i18n/messages";

export const API_URL =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL?.trim()) ||
    "http://127.0.0.1:3200";
export { ApiError } from "./auth-storage";

/** Browser/site origin for uploaded media. Never prefix avatars with localhost:3200. */
export function publicAssetUrl(path?: string | null) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
    const pathOnly = value.startsWith("/") ? value : `/${value}`;
    if (typeof window !== "undefined") return pathOnly;
    const site = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "")
        .trim()
        .replace(/\/$/, "");
    if (site && !/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?$/i.test(site)) {
        return `${site}${pathOnly}`;
    }
    return pathOnly;
}

/** Same-origin Next proxy → Nest Socket.IO. Never hit :3200 from the browser (CORS / firewall / Cloudflare). */
export function socketIoPath() {
    return "/live-io";
}

export const SOCKET_IO_PATH = "/live-io";

export function apiSocketUrl() {
    if (typeof window === "undefined") return API_URL;
    return window.location.origin;
}

function apiBase() {
    if (typeof window !== "undefined") {
        return "/api";
    }
    return API_URL;
}

const SKIP_CSRF_BOOTSTRAP = [
    "/auth/login",
    "/auth/register",
    "/auth/register-streamer",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "/auth/resend-verification",
    "/auth/refresh",
    "/auth/csrf",
];

function csrfHeader(method: string): Record<string, string> {
    const m = method.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(m)) return {};
    const csrf = getCsrfToken();
    if (!csrf) return {};
    return { "X-CSRF-Token": csrf };
}

function needsCsrfBootstrap(method: string, path: string) {
    const m = method.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(m)) return false;
    return !SKIP_CSRF_BOOTSTRAP.some(
        (p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`),
    );
}

let csrfInFlight: Promise<void> | null = null;

async function ensureCsrf(force = false) {
    if (typeof window === "undefined") return;
    if (!force && getCsrfToken()) return;
    if (csrfInFlight) return csrfInFlight;
    csrfInFlight = (async () => {
        try {
            const response = await fetch(`${apiBase()}/auth/csrf`, { credentials: "include" });
            const data = await parseJson(response);
            applySessionPayload(data);
        } catch {
            /* POST still 403 if bootstrap fails */
        } finally {
            csrfInFlight = null;
        }
    })();
    return csrfInFlight;
}

function applySessionPayload(data: any) {
    if (typeof data?.csrfToken === "string" && data.csrfToken) setCsrfToken(data.csrfToken);
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
        try {
            const url = `${apiBase()}/auth/refresh`;
            const response = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    ...csrfHeader("POST"),
                },
                body: "{}",
            });
            if (!response.ok) return false;
            const data = await response.json().catch(() => null);
            applySessionPayload(data);
            return response.ok;
        } catch {
            return false;
        } finally {
            refreshInFlight = null;
        }
    })();
    return refreshInFlight;
}

async function parseJson(response: Response) {
    const text = await response.text();
    let data: any = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text };
        }
    }
    return data;
}

function requestLocale() {
    if (typeof window === "undefined") return FALLBACK_GUEST_LOCALE;
    const fromDom = document.documentElement.lang;
    if (isLocale(fromDom)) return fromDom;
    const stored = window.localStorage.getItem("liveshow_locale");
    if (isLocale(stored)) return stored;
    return FALLBACK_GUEST_LOCALE;
}

function isGenericHttpFailureLabel(text: string) {
    const value = text.trim();
    if (!value) return true;
    if (/^internal server error$/i.test(value)) return true;
    if (/<html[\s>]/i.test(value)) return true;
    return false;
}

function throwIfNotOk(response: Response, data: any) {
    if (response.ok) return;
    const raw = data?.message ?? data?.error;
    const joined = Array.isArray(raw)
        ? raw.map((item) => String(item || "").trim()).filter(Boolean).join(" ")
        : String(raw || "").trim();
    const locale = requestLocale();
    const shown = isGenericHttpFailureLabel(joined)
        ? translate("common.error", locale)
        : joined || `API error: ${response.status}`;
    const fields =
        data?.fields && typeof data.fields === "object" && !Array.isArray(data.fields)
            ? (data.fields as Record<string, string>)
            : undefined;
    throw new ApiError(shown, response.status, fields);
}

type Extra = { skipRefresh?: boolean };

export async function apiFetch(path: string, options: RequestInit & Extra = {}) {
    const { skipRefresh, ...rest } = options;
    let url = path.startsWith("http") ? path : `${apiBase()}${path}`;
    const locale = requestLocale();
    if (!url.startsWith("http") || url.includes("/api")) {
        const hasLang = url.includes("lang=");
        const method = String(rest.method || "GET").toUpperCase();
        if (method === "GET" && !hasLang && !url.includes("/i18n/catalog")) {
            url += `${url.includes("?") ? "&" : "?"}lang=${encodeURIComponent(locale)}`;
        }
    }

    const method = String(rest.method || "GET");
    if (needsCsrfBootstrap(method, path) && !skipRefresh) {
        await ensureCsrf();
    }
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Locale": locale,
        ...(rest.headers as Record<string, string> | undefined),
        ...csrfHeader(method),
    };

    let response: Response;
    try {
        response = await fetch(url, {
            ...rest,
            method,
            credentials: "include",
            headers,
        });
    } catch {
        throw new ApiError(
            "A szolgáltatás most nem elérhető. Ellenőrizd az internetkapcsolatot, majd próbáld újra.",
            0,
        );
    }

    if (response.status === 401 && !skipRefresh && !path.includes("/auth/refresh")) {
        const ok = await tryRefresh();
        if (ok) return apiFetch(path, { ...options, skipRefresh: true });
    }

    const data = await parseJson(response);
    if (response.status === 403 && !skipRefresh && isCsrfFailure(null, data)) {
        await ensureCsrf(true);
        if (getCsrfToken()) return apiFetch(path, { ...options, skipRefresh: true });
        const ok = await tryRefresh();
        if (ok) return apiFetch(path, { ...options, skipRefresh: true });
    }
    throwIfNotOk(response, data);
    applySessionPayload(data);
    return data;
}

export async function apiUpload(path: string, formData: FormData, method = "POST", retried = false) {
    const url = path.startsWith("http") ? path : `${apiBase()}${path}`;
    const locale = requestLocale();

    const headers: Record<string, string> = {
        "X-Locale": locale,
        ...csrfHeader(method),
    };

    let response: Response;
    try {
        response = await fetch(url, {
            method,
            body: formData,
            credentials: "include",
            headers,
        });
    } catch {
        throw new ApiError(
            "A szolgáltatás most nem elérhető. Ellenőrizd az internetkapcsolatot, majd próbáld újra.",
            0,
        );
    }

    if (response.status === 401 && !path.includes("/auth/refresh") && !retried) {
        const ok = await tryRefresh();
        if (ok) return apiUpload(path, formData, method, true);
    }

    const data = await parseJson(response);
    if (response.status === 403 && !retried && isCsrfFailure(null, data)) {
        const ok = await tryRefresh();
        if (ok) return apiUpload(path, formData, method, true);
    }
    throwIfNotOk(response, data);
    applySessionPayload(data);
    return data;
}

export async function apiDownload(path: string, filename: string) {
    const url = path.startsWith("http") ? path : `${apiBase()}${path}`;
    const response = await fetch(url, {
        credentials: "include",
        headers: { ...csrfHeader("GET") },
    });
    if (response.status === 401) {
        const ok = await tryRefresh();
        if (ok) return apiDownload(path, filename);
    }
    if (!response.ok) {
        throw new ApiError("A bizonylat nem tölthető le.", response.status);
    }
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
}

export async function api(path: string, options: RequestInit = {}) {
    return apiFetch(path, options);
}

export function asList<T = any>(data: unknown): T[] {
    if (Array.isArray(data)) return data as T[];
    if (!data || typeof data !== "object") return [];
    const row = data as Record<string, unknown>;
    for (const key of ["items", "rows", "tickets", "data", "value"]) {
        if (Array.isArray(row[key])) return row[key] as T[];
    }
    return [];
}
