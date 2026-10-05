import type { MetadataRoute } from "next";
import { VIDEO_CATEGORIES } from "../lib/video-categories";
import {
    fetchPublicArchives,
    fetchPublicShows,
    fetchPublicStreamers,
    INDEXABLE_STATIC_PATHS,
    siteUrl,
} from "../lib/seo";
import { PREFIX_LOCALES, withLocalePrefix } from "../lib/i18n/paths";
import { DEFAULT_LOCALE } from "../lib/i18n/messages";

function locUrl(path: string, locale: string) {
    const base = siteUrl();
    const prefixed = withLocalePrefix(path, locale);
    return `${base}${prefixed === "/" ? "" : prefixed}`;
}

function localizedUrls(path: string): MetadataRoute.Sitemap[number] {
    const languages: Record<string, string> = {
        "x-default": locUrl(path, DEFAULT_LOCALE),
        hu: locUrl(path, DEFAULT_LOCALE),
    };
    for (const code of PREFIX_LOCALES) {
        languages[code] = locUrl(path, code);
    }
    return {
        url: locUrl(path, DEFAULT_LOCALE),
        lastModified: new Date(),
        changeFrequency: path === "/" ? "hourly" : "daily",
        priority: path === "/" ? 1 : path.startsWith("/shows/") || path.startsWith("/streamers/") ? 0.8 : 0.7,
        alternates: { languages },
    };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    try {
        const entries: MetadataRoute.Sitemap = INDEXABLE_STATIC_PATHS.map((path) =>
            localizedUrls(path),
        );

        for (const cat of VIDEO_CATEGORIES) {
            entries.push(localizedUrls(`/archive/category/${cat.value}`));
        }

        const [shows, streamers, archives] = await Promise.all([
            fetchPublicShows(),
            fetchPublicStreamers(),
            fetchPublicArchives(),
        ]);

        const showIds = new Set<string>();
        for (const show of shows) {
            const id = String(show.id || "").trim();
            if (!id) continue;
            showIds.add(id);
            entries.push(localizedUrls(`/shows/${id}`));
            if (show.live) entries.push(localizedUrls(`/live/${id}`));
        }

        for (const item of archives) {
            const id = String(item.showId || "").trim();
            if (!id || item.exists === false) continue;
            if (!showIds.has(id)) {
                showIds.add(id);
                entries.push(localizedUrls(`/shows/${id}`));
            }
            entries.push(localizedUrls(`/archive/${id}`));
        }

        for (const streamer of streamers) {
            const id = String(streamer.id || "").trim();
            if (!id) continue;
            entries.push(localizedUrls(`/streamers/${id}`));
        }

        return entries;
    } catch {
        return INDEXABLE_STATIC_PATHS.map((path) => localizedUrls(path));
    }
}
