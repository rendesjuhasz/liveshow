import { DEFAULT_LOCALE, LOCALES, type Locale } from "./messages";

export const PREFIX_LOCALES = LOCALES.filter((code) => code !== DEFAULT_LOCALE);

export function stripLocalePrefix(pathname: string): { locale: Locale | string; path: string } {
    const match = pathname.match(/^\/(en|de|it|es|fr)(?=\/|$)/);
    if (!match) return { locale: DEFAULT_LOCALE, path: pathname || "/" };
    const rest = pathname.slice(match[0].length) || "/";
    return { locale: match[1], path: rest.startsWith("/") ? rest : `/${rest}` };
}

export function withLocalePrefix(path: string, locale: string) {
    const p = path.startsWith("/") ? path : `/${path}`;
    if (!locale || locale === DEFAULT_LOCALE) return p;
    if (p === "/") return `/${locale}`;
    return `/${locale}${p}`;
}

export function isLocalePrefixedAppPath(pathname: string) {
    if (
        pathname.startsWith("/api") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/stream") ||
        pathname.startsWith("/output") ||
        pathname.startsWith("/uploads")
    ) {
        return false;
    }
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return false;
    if (pathname === "/streamer" || pathname.startsWith("/streamer/")) return false;
    return true;
}
