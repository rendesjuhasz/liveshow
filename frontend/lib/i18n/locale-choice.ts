import { DEFAULT_LOCALE, detectLocale, isLocale, type Locale } from "./messages";

export const LOCALE_COOKIE = "liveshow_locale";
export const LOCALE_CHOSEN_COOKIE = "liveshow_locale_chosen";

export function hasChosenLocaleCookie(cookieHeader?: string | null) {
    const raw =
        cookieHeader ?? (typeof document !== "undefined" ? document.cookie : "");
    return new RegExp(`(?:^|;\\s*)${LOCALE_CHOSEN_COOKIE}=1(?:;|$)`).test(raw);
}

export function readLocaleCookie(cookieHeader?: string | null): string | null {
    const raw =
        cookieHeader ?? (typeof document !== "undefined" ? document.cookie : "");
    const match = raw.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`));
    if (!match) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

export function hasExplicitLocaleChoice(cookieHeader?: string | null) {
    if (hasChosenLocaleCookie(cookieHeader)) return true;
    try {
        return typeof window !== "undefined" && window.localStorage.getItem(LOCALE_CHOSEN_COOKIE) === "1";
    } catch {
        return false;
    }
}

/**
 * Public request locale:
 * 1. URL prefix (/en, /de, …) — explicit link, even without chosen cookie
 * 2. Explicit picker choice (chosen cookie + liveshow_locale)
 * 3. User.locale is applied in I18nProvider after login (not here)
 * 4. Accept-Language, if a supported language
 * 5. FALLBACK_GUEST_LOCALE (en)
 *
 * Does not set liveshow_locale_chosen.
 */
export function resolvePublicLocale(
    pathLocale: string,
    cookieLocale?: string | null,
    localeChosen?: boolean,
    acceptLanguage?: string | null,
): Locale {
    if (pathLocale !== DEFAULT_LOCALE && isLocale(pathLocale)) return pathLocale;
    if (localeChosen && isLocale(cookieLocale)) return cookieLocale;
    return detectLocale(acceptLanguage);
}

export function needsLocalePrefixRedirect(
    pathLocale: string,
    chosen: string,
    localeChosen?: boolean,
) {
    if (!localeChosen) return false;
    return pathLocale === DEFAULT_LOCALE && chosen !== DEFAULT_LOCALE;
}
