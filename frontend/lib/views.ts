import { DEFAULT_LOCALE, formatNumber, isLocale, translate } from "@/lib/i18n/messages";

function countLocale(locale?: string | null) {
    if (isLocale(locale)) return locale;
    if (typeof document !== "undefined" && isLocale(document.documentElement.lang)) {
        return document.documentElement.lang;
    }
    return DEFAULT_LOCALE;
}

export function formatCount(n?: number | null, locale?: string | null) {
    return formatNumber(Math.max(0, Math.floor(Number(n) || 0)), countLocale(locale));
}

export function viewsLabel(n?: number | null, locale?: string | null) {
    return translate("media.views", countLocale(locale)).replace("{n}", formatCount(n, locale));
}

export function liveViewersLabel(n?: number | null, locale?: string | null) {
    const loc = countLocale(locale);
    const count = Math.max(0, Math.floor(Number(n) || 0));
    return translate("media.watchingNow", loc).replace("{n}", formatCount(count, loc));
}

export function liveViewersShort(n?: number | null, locale?: string | null) {
    return translate("media.viewers", countLocale(locale)).replace("{n}", formatCount(n, locale));
}

export function formatWatchDuration(seconds?: number | null) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return `${s} mp`;
    const minutes = Math.floor(s / 60);
    const rem = s % 60;
    if (minutes < 60) {
        return rem ? `${minutes} p ${rem} mp` : `${minutes} perc`;
    }
    const hours = Math.floor(minutes / 60);
    const min = minutes % 60;
    return min ? `${hours} ó ${min} p` : `${hours} óra`;
}

export const ARCHIVE_SORTS = [
    { id: "popular", label: "Legnépszerűbb" },
    { id: "views", label: "Legtöbb megtekintés" },
    { id: "newest", label: "Legújabb" },
    { id: "oldest", label: "Legrégebbi" },
] as const;

export type ArchiveSortId = (typeof ARCHIVE_SORTS)[number]["id"];
