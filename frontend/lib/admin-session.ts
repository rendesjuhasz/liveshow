import { stripLocalePrefix } from "@/lib/i18n/paths";

const API =
    (typeof process !== "undefined" &&
        (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL)?.trim()) ||
    "http://127.0.0.1:3200";

export function isAdminConsolePath(pathname: string) {
    const { path } = stripLocalePrefix(pathname || "");
    return path === "/admin" || path.startsWith("/admin/");
}

export function isAdminLoginPath(pathname: string) {
    const { path } = stripLocalePrefix(pathname || "");
    return path === "/admin/login";
}

function isAdminPayload(data: unknown) {
    const raw = (data && typeof data === "object" ? data : {}) as { user?: unknown; role?: string; isAdmin?: boolean };
    const user = (raw.user && typeof raw.user === "object" ? raw.user : raw) as {
        role?: string;
        isAdmin?: boolean;
    };
    if (user.isAdmin === true) return true;
    return String(user.role || "").trim().toLowerCase() === "admin";
}

export async function fetchAdminSession(cookieHeader: string) {
    if (!cookieHeader || (!cookieHeader.includes("ls_access=") && !cookieHeader.includes("ls_refresh="))) {
        return { kind: "anon" as const };
    }
    try {
        const res = await fetch(`${API}/auth/me`, {
            headers: { cookie: cookieHeader },
            cache: "no-store",
            signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return { kind: "anon" as const };
        const data = await res.json().catch(() => null);
        if (isAdminPayload(data)) return { kind: "admin" as const };
        return { kind: "user" as const };
    } catch {
        return { kind: "anon" as const };
    }
}
