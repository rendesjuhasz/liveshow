import { ApiError, getAuthToken } from "./auth-storage";

export const API_URL =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL?.trim()) ||
    "http://127.0.0.1:3200";
export { ApiError } from "./auth-storage";

function apiBase() {
    if (typeof window !== "undefined") {
        return "/api";
    }
    return API_URL;
}

function withAuthHeader(path: string, token: string | null) {
    if (!token) return {};
    const p = path.toLowerCase();
    if (
        p.includes("/auth/login") ||
        p.includes("/auth/register") ||
        p.includes("/auth/register-streamer") ||
        p.includes("/auth/forgot-password") ||
        p.includes("/auth/reset-password")
    ) {
        return {};
    }
    return { Authorization: `Bearer ${token}` };
}

export async function apiFetch(path: string, options: RequestInit = {}) {
    const token = getAuthToken();
    let url = path.startsWith("http") ? path : `${apiBase()}${path}`;
    const locale =
        typeof window !== "undefined"
            ? window.localStorage.getItem("liveshow_locale") || "hu"
            : "hu";
    if (!url.startsWith("http") || url.includes("/api")) {
        const hasLang = url.includes("lang=");
        const method = String(options.method || "GET").toUpperCase();
        if (method === "GET" && !hasLang && !url.includes("/i18n/catalog")) {
            url += `${url.includes("?") ? "&" : "?"}lang=${encodeURIComponent(locale)}`;
        }
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Locale": locale,
        ...(options.headers as Record<string, string> | undefined),
        ...withAuthHeader(path, token),
    };

    let response: Response;
    try {
        response = await fetch(url, {
            ...options,
            headers,
        });
    } catch {
        throw new ApiError(
            "A backend nem elérhető. Indítsd el a backendet (localhost:3200), aztán próbáld újra.",
            0,
        );
    }

    const text = await response.text();
    let data: any = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text };
        }
    }

    if (!response.ok) {
        const message =
            data?.message ||
            data?.error ||
            (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
            `API error: ${response.status}`;
        throw new ApiError(
            typeof message === "string" ? message : `API error: ${response.status}`,
            response.status,
        );
    }

    return data;
}

export async function apiUpload(path: string, formData: FormData, method = "POST") {
    const token = getAuthToken();
    const direct = typeof window !== "undefined" && path.includes("/streamer/vod");
    const url = path.startsWith("http")
        ? path
        : `${direct ? API_URL : apiBase()}${path}`;

    const headers: Record<string, string> = {
        ...withAuthHeader(path, token),
    };

    let response: Response;
    try {
        response = await fetch(url, {
            method,
            body: formData,
            headers,
        });
    } catch {
        throw new ApiError(
            "A backend nem elérhető. Indítsd el a backendet (localhost:3200), aztán próbáld újra.",
            0,
        );
    }

    const text = await response.text();
    let data: any = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text };
        }
    }

    if (!response.ok) {
        const message =
            data?.message ||
            data?.error ||
            (Array.isArray(data?.message) ? data.message.join(", ") : null) ||
            `API error: ${response.status}`;
        throw new ApiError(
            typeof message === "string" ? message : `API error: ${response.status}`,
            response.status,
        );
    }

    return data;
}

export async function apiDownload(path: string, filename: string) {
    const token = getAuthToken();
    const url = path.startsWith("http") ? path : `${apiBase()}${path}`;
    const response = await fetch(url, {
        headers: { ...withAuthHeader(path, token) },
    });
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
