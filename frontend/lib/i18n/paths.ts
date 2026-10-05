import { DEFAULT_LOCALE, LOCALES, type Locale } from "./messages";

export const PREFIX_LOCALES = LOCALES.filter((code) => code !== DEFAULT_LOCALE);

export function stripLocalePrefix(pathname: string): { locale: Locale | string; path: string } {
    const match = pathname.match(/^\/(en|de|it|es|fr)(?=\/|$)/);
    if (!match) return { locale: DEFAULT_LOCALE, path: pathname || "/" };
    const rest = pathname.slice(match[0].length) || "/";
    return { locale: match[1], path: rest.startsWith("/") ? rest : `/${rest}` };
}

export function withLocalePrefix(path: string, locale: string) {
    const hashIdx = path.indexOf("#");
    const hash = hashIdx >= 0 ? path.slice(hashIdx) : "";
    const noHash = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
    const qIdx = noHash.indexOf("?");
    const search = qIdx >= 0 ? noHash.slice(qIdx) : "";
    const raw = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
    const p = raw.startsWith("/") ? raw : `/${raw}`;
    if (!locale || locale === DEFAULT_LOCALE) return `${p}${search}${hash}`;
    if (p === "/") return `/${locale}${search}${hash}`;
    return `/${locale}${p}${search}${hash}`;
}

export function isLocalePrefixedAppPath(pathname: string) {
    if (
        pathname.startsWith("/api") ||
        pathname.startsWith("/live-io") ||
        pathname.startsWith("/socket.io") ||
        pathname.startsWith("/_next") ||
        pathname === "/stream" ||
        pathname.startsWith("/stream/") ||
        pathname.startsWith("/output") ||
        pathname.startsWith("/media")
    ) {
        return false;
    }
    if (
        pathname === "/sitemap.xml" ||
        pathname === "/robots.txt" ||
        pathname.startsWith("/opengraph-image") ||
        pathname.startsWith("/twitter-image")
    ) {
        return false;
    }
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return false;
    if (pathname === "/streamer" || pathname.startsWith("/streamer/")) return false;
    return true;
}
