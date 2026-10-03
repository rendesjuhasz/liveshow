/** Publikus web URL — e-mail, fizetés, OAuth, naptár, megosztás. */
export const DEFAULT_PUBLIC_SITE = "https://streamtest.hu";
export const DEFAULT_LOCAL_SITE = "http://127.0.0.1:3000";

function stripSlash(url: string) {
    return url.replace(/\/+$/, "");
}

function isLocalHostUrl(url: string) {
    return /localhost|127\.0\.0\.1/i.test(url);
}

function firstEnv(...keys: string[]) {
    for (const key of keys) {
        const raw = (process.env[key] || "").trim();
        if (raw) return raw;
    }
    return "";
}

/** Böngészőben látható origin (APP_URL / FRONTEND_URL / SITE_URL). */
export function publicFrontendUrl(): string {
    const fromEnv = firstEnv(
        "APP_URL",
        "NEXT_PUBLIC_APP_URL",
        "FRONTEND_URL",
        "SITE_URL",
        "NEXT_PUBLIC_SITE_URL",
    );
    if (process.env.NODE_ENV !== "production") {
        if (fromEnv && isLocalHostUrl(fromEnv)) return stripSlash(fromEnv);
        return DEFAULT_LOCAL_SITE;
    }
    return stripSlash(fromEnv || DEFAULT_PUBLIC_SITE);
}

/**
 * Nyilvános API origin (webhook, OAuth callback).
 * Ha a Next ugyanazon a domainen proxizza a `/api`-t, ez megegyezik a frontenddel.
 */
export function publicBackendUrl(): string {
    const raw = firstEnv("BACKEND_PUBLIC_URL", "BACKEND_URL");
    if (raw) return stripSlash(raw);
    return publicFrontendUrl();
}
