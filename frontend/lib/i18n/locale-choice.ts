import { DEFAULT_LOCALE, isLocale, type Locale } from "./messages";

export const LOCALE_COOKIE = "liveshow_locale";
export const LOCALE_CHOSEN_COOKIE = "liveshow_locale_chosen";

export function hasChosenLocaleCookie(cookieHeader?: string | null) {
    const raw =
        cookieHeader ?? (typeof document !== "undefined" ? document.cookie : "");
    return new RegExp(`(?:^|;\\s*)${LOCALE_CHOSEN_COOKIE}=1(?:;|$)`).test(raw);
}

/** Prefix/path locale counts only after an explicit language pick. */
export function resolvePublicLocale(
    pathLocale: string,
    cookieLocale?: string | null,
    localeChosen?: boolean,
): Locale {
    if (!localeChosen) return DEFAULT_LOCALE;
    if (pathLocale !== DEFAULT_LOCALE && isLocale(pathLocale)) return pathLocale;
    if (isLocale(cookieLocale)) return cookieLocale;
    return DEFAULT_LOCALE;
}

export function needsLocalePrefixRedirect(pathLocale: string, chosen: string) {
    return pathLocale === DEFAULT_LOCALE && chosen !== DEFAULT_LOCALE;
}
