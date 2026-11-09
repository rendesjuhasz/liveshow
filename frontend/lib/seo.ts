import type { Metadata } from "next";
import { DEFAULT_LOCALE, isLocale, translate, type Locale } from "./i18n/messages";
import { PREFIX_LOCALES, withLocalePrefix } from "./i18n/paths";
import { coverUrl } from "./media";
import { streamerCategoryLabel } from "./streamer-categories";
import { isVideoCategory, videoCategoryLabel } from "./video-categories";

export function siteUrl() {
    return String(
        process.env.NEXT_PUBLIC_SITE_URL ||
            process.env.APP_URL ||
            process.env.FRONTEND_URL ||
            "https://streamtest.hu",
    ).replace(/\/$/, "");
}

export function apiBase() {
    return String(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3200").replace(/\/$/, "");
}

export function localeFromCookie(raw?: string | null): Locale {
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

export const INDEXABLE_STATIC_PATHS = [
    "/",
    "/shows",
    "/live",
    "/archive",
    "/streamers",
    "/leaderboard",
    "/faq",
    "/kapcsolat",
    "/aszf",
    "/adatkezeles",
    "/moderalasi-szabalyzat",
    "/jogi-nyilatkozat",
    "/cookie-tajekoztato",
    "/status",
    "/streamer-terms",
] as const;

const STATIC_SEO: Record<string, { title: string; description: string }> = {
    "/": { title: "seo.title", description: "seo.description" },
    "/shows": { title: "seo.showsTitle", description: "seo.showsDesc" },
    "/live": { title: "seo.liveTitle", description: "seo.liveDesc" },
    "/archive": { title: "seo.archiveTitle", description: "seo.archiveDesc" },
    "/streamers": { title: "seo.streamersTitle", description: "seo.streamersDesc" },
    "/leaderboard": { title: "seo.leaderboardTitle", description: "seo.leaderboardDesc" },
    "/faq": { title: "seo.faqTitle", description: "seo.faqDesc" },
    "/kapcsolat": { title: "seo.contactTitle", description: "seo.contactDesc" },
    "/aszf": { title: "seo.aszfTitle", description: "seo.aszfDesc" },
    "/adatkezeles": { title: "seo.privacyTitle", description: "seo.privacyDesc" },
    "/moderalasi-szabalyzat": { title: "seo.moderationTitle", description: "seo.moderationDesc" },
    "/jogi-nyilatkozat": { title: "seo.legalTitle", description: "seo.legalDesc" },
    "/cookie-tajekoztato": { title: "seo.cookieTitle", description: "seo.cookieDesc" },
    "/status": { title: "seo.statusTitle", description: "seo.statusDesc" },
    "/streamer-terms": { title: "seo.streamerTermsTitle", description: "seo.streamerTermsDesc" },
    "/tickets": { title: "seo.ticketsTitle", description: "seo.ticketsDesc" },
};

export function isPrivateSeoPath(path: string) {
    if (path === "/streamer" || path.startsWith("/streamer/")) return true;
    if (path === "/admin" || path.startsWith("/admin/")) return true;
    if (path === "/profile" || path.startsWith("/profile/")) return true;
    if (path === "/private-stream" || path.startsWith("/private-stream/")) return true;
    if (path === "/payment" || path.startsWith("/payment/")) return true;
    if (path.startsWith("/tickets/")) return true;
    return [
        "/login",
        "/register",
        "/streamer-login",
        "/streamer-register",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/username",
    ].includes(path);
}

function languageMap(path: string) {
    const languages: Record<string, string> = {
        "x-default": withLocalePrefix(path, DEFAULT_LOCALE),
        hu: withLocalePrefix(path, DEFAULT_LOCALE),
    };
    for (const code of PREFIX_LOCALES) {
        languages[code] = withLocalePrefix(path, code);
    }
    return languages;
}

function absoluteAsset(url?: string | null) {
    const value = String(url || "").trim();
    if (!value) return `${siteUrl()}/opengraph-image`;
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/uploads/") || value.startsWith("/media/")) return `${siteUrl()}${value}`;
    if (value.startsWith("/")) return `${siteUrl()}${value}`;
    return `${siteUrl()}/opengraph-image`;
}

function pack(opts: {
    title: string;
    description: string;
    path: string;
    locale: string;
    image?: string | null;
    index: boolean;
    ogType?: "website" | "profile" | "video.other";
}): Metadata {
    const canonicalPath = withLocalePrefix(opts.path, opts.locale);
    const url = `${siteUrl()}${canonicalPath === "/" ? "" : canonicalPath}`;
    const image = absoluteAsset(opts.image);
    const robots = opts.index
        ? { index: true, follow: true }
        : { index: false, follow: false };
    return {
        title: opts.title,
        description: opts.description,
        robots,
        alternates: {
            canonical: url,
            languages: languageMap(opts.path),
        },
        openGraph: {
            type: opts.ogType || "website",
            siteName: "LiveShow",
            locale: opts.locale === "hu" ? "hu_HU" : opts.locale,
            url,
            title: opts.title,
            description: opts.description,
            images: [{ url: image, width: 1200, height: 630, alt: opts.title }],
        },
        twitter: {
            card: "summary_large_image",
            title: opts.title,
            description: opts.description,
            images: [image],
        },
    };
}

async function fetchJson<T>(path: string): Promise<T | null> {
    try {
        const res = await fetch(`${apiBase()}${path}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
        });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

type ShowRow = {
    id?: string;
    title?: string;
    description?: string;
    image?: string | null;
    live?: boolean;
    streamer?: { name?: string | null } | null;
};

type StreamerRow = {
    id?: string;
    name?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    category?: string | null;
    shows?: { id?: string; title?: string; live?: boolean; startTime?: string }[];
};

async function resolveShow(id: string, locale: string): Promise<ShowRow | null> {
    const direct = await fetchJson<ShowRow>(`/shows/${encodeURIComponent(id)}?lang=${locale}`);
    if (direct?.title) return direct;
    const streamers = await fetchPublicStreamers();
    for (const streamer of streamers) {
        const hit = (streamer.shows || []).find((item) => String(item.id) === id);
        if (!hit) continue;
        return {
            id: hit.id,
            title: hit.title,
            description: `${hit.title} · ${streamer.name || ""} · LiveShow`.replace(/\s+·\s+$/, ""),
            live: hit.live,
            streamer: { name: streamer.name },
        };
    }
    return null;
}

function clip(text: string, max = 160) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 1).trim()}…`;
}

export async function metadataForPath(path: string, locale: string): Promise<Metadata> {
    const loc = isLocale(locale) ? locale : DEFAULT_LOCALE;

    if (isPrivateSeoPath(path)) {
        const title =
            path === "/admin" || path.startsWith("/admin/")
                ? translate("seo.adminTitle", loc)
                : path === "/streamer" ||
                    path.startsWith("/streamer/") ||
                    path === "/streamer-login" ||
                    path === "/streamer-register" ||
                    path === "/streamer-terms"
                  ? translate("seo.streamerAppTitle", loc)
                  : path === "/login" || path === "/register"
                    ? translate("seo.viewerTitle", loc)
                    : translate("seo.privateTitle", loc);
        return pack({
            title,
            description: translate("seo.privateDesc", loc),
            path,
            locale: loc,
            index: false,
        });
    }

    const showMatch = path.match(/^\/(shows|live|archive)\/([^/]+)$/);
    if (showMatch && showMatch[1] !== "archive") {
        const kind = showMatch[1];
        const id = decodeURIComponent(showMatch[2]);
        const show = await resolveShow(id, loc);
        const title = show?.title?.trim() || translate("seo.showFallback", loc);
        const desc =
            clip(String(show?.description || "")) ||
            `${title}${show?.streamer?.name ? ` · ${show.streamer.name}` : ""} · LiveShow`;
        const pageTitle =
            kind === "live"
                ? `${title} · ${translate("nav.live", loc)} · LiveShow`
                : `${title} · LiveShow`;
        return pack({
            title: pageTitle,
            description: desc,
            path,
            locale: loc,
            image: coverUrl(show || { id }),
            index: Boolean(show?.title),
            ogType: "video.other",
        });
    }

    if (path.startsWith("/archive/category/")) {
        const slug = decodeURIComponent(path.slice("/archive/category/".length));
        const label = isVideoCategory(slug) ? videoCategoryLabel(slug) : slug;
        return pack({
            title: `${label} · ${translate("seo.archiveTitle", loc)}`,
            description: `${translate("seo.archiveDesc", loc)} ${label}.`,
            path,
            locale: loc,
            index: isVideoCategory(slug),
        });
    }

    if (path.startsWith("/archive/") && path !== "/archive") {
        const id = decodeURIComponent(path.slice("/archive/".length).split("/")[0] || "");
        const show = await resolveShow(id, loc);
        const title = show?.title?.trim() || translate("seo.showFallback", loc);
        const desc =
            clip(String(show?.description || "")) ||
            `${title} · ${translate("seo.archiveDesc", loc)}`;
        return pack({
            title: `${title} · ${translate("nav.archive", loc)} · LiveShow`,
            description: desc,
            path,
            locale: loc,
            image: coverUrl(show || { id }),
            index: Boolean(show?.title),
            ogType: "video.other",
        });
    }

    const streamerMatch = path.match(/^\/streamers\/([^/]+)$/);
    if (streamerMatch) {
        const id = decodeURIComponent(streamerMatch[1]);
        const streamer = await fetchJson<StreamerRow>(`/streamers/${encodeURIComponent(id)}`);
        const name = streamer?.name?.trim() || translate("seo.streamerFallback", loc);
        const cat = streamerCategoryLabel(streamer?.category);
        const desc =
            clip(String(streamer?.bio || "")) ||
            `${name}${cat ? ` · ${cat}` : ""} · LiveShow`;
        return pack({
            title: `${name} · LiveShow`,
            description: desc,
            path,
            locale: loc,
            image: streamer?.avatarUrl || undefined,
            index: Boolean(streamer?.name),
            ogType: "profile",
        });
    }

    const staticKeys = STATIC_SEO[path];
    if (staticKeys) {
        return pack({
            title: translate(staticKeys.title, loc),
            description: translate(staticKeys.description, loc),
            path,
            locale: loc,
            index: true,
        });
    }

    return pack({
        title: translate("seo.title", loc),
        description: translate("seo.description", loc),
        path,
        locale: loc,
        index: false,
    });
}

export async function fetchPublicShows() {
    const rows = await fetchJson<ShowRow[]>("/shows");
    if (Array.isArray(rows) && rows.length) return rows;
    const streamers = await fetchPublicStreamers();
    const out: ShowRow[] = [];
    for (const streamer of streamers) {
        for (const show of streamer.shows || []) {
            if (!show.id) continue;
            out.push({
                id: show.id,
                title: show.title,
                live: show.live,
                streamer: { name: streamer.name },
            });
        }
    }
    return out;
}

export async function fetchPublicStreamers() {
    const rows = await fetchJson<StreamerRow[]>("/streamers");
    return Array.isArray(rows) ? rows : [];
}

export async function fetchPublicArchives() {
    const rows = await fetchJson<{ showId?: string; exists?: boolean }[]>("/archives");
    return Array.isArray(rows) ? rows : [];
}
