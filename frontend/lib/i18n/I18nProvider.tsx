"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import {
    DEFAULT_LOCALE,
    formatDateTime,
    formatMoney,
    isLocale,
    LOCALE_META,
    LOCALES,
    translate,
    type Locale,
} from "./messages";
import { stripLocalePrefix, withLocalePrefix } from "./paths";
import { hasChosenLocaleCookie, LOCALE_CHOSEN_COOKIE, LOCALE_COOKIE } from "./locale-choice";

const STORAGE = "liveshow_locale";
const CHOSEN = "liveshow_locale_chosen";

type Lang = { code: string; name: string; nativeName: string; enabled?: boolean };

type I18nContextType = {
    locale: string;
    languages: Lang[];
    t: (key: string) => string;
    setLocale: (next: string) => Promise<void>;
    formatMoney: (amount: number) => string;
    formatDateTime: (value: string | Date | null | undefined) => string;
};

const I18nContext = createContext<I18nContextType>({
    locale: DEFAULT_LOCALE,
    languages: LOCALES.map((code) => ({
        code,
        name: LOCALE_META[code].name,
        nativeName: LOCALE_META[code].nativeName,
        enabled: true,
    })),
    t: (key) => translate(key, DEFAULT_LOCALE),
    setLocale: async () => undefined,
    formatMoney: (amount) => formatMoney(amount, DEFAULT_LOCALE),
    formatDateTime: (value) => formatDateTime(value, DEFAULT_LOCALE),
});

function writeCookie(locale: string, chosen = false) {
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=31536000; SameSite=Lax${secure}`;
    if (chosen) {
        document.cookie = `${LOCALE_CHOSEN_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax${secure}`;
    }
}

export function I18nProvider({
    children,
    initialLocale,
}: {
    children: ReactNode;
    initialLocale?: string;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();
    // Locale-prefixed URLs are rewritten to unprefixed routes (next.config). On the
    // server `usePathname()` is the rewritten path (`/forgot-password`); in the
    // browser it is `/en/forgot-password`. Prefer the URL prefix, else middleware
    // `x-locale` (initialLocale), so SSR and hydration use the same language.
    const pathHasLocalePrefix = /^\/(en|de|it|es|fr)(?=\/|$)/.test(pathname || "");
    const pathLocale = stripLocalePrefix(pathname || "/").locale;
    const honorPathLocale =
        pathHasLocalePrefix &&
        isLocale(pathLocale) &&
        isLocale(initialLocale) &&
        initialLocale === pathLocale;
    const resolvedLocale = (
        honorPathLocale && isLocale(pathLocale)
            ? pathLocale
            : isLocale(initialLocale)
              ? initialLocale
              : DEFAULT_LOCALE
    ) as Locale;
    const [locale, setLocaleState] = useState<string>(resolvedLocale);
    const [catalogLocale, setCatalogLocale] = useState<string>(resolvedLocale);
    const [messages, setMessages] = useState<Record<string, string>>({});
    const [languages, setLanguages] = useState<Lang[]>(
        LOCALES.map((code) => ({
            code,
            name: LOCALE_META[code].name,
            nativeName: LOCALE_META[code].nativeName,
            enabled: true,
        })),
    );

    const loadCatalog = useCallback(async (lang: string) => {
        try {
            const data = await apiFetch(`/i18n/catalog?lang=${encodeURIComponent(lang)}`);
            if (data?.messages) {
                setMessages(data.messages);
                setCatalogLocale(lang);
            }
            if (Array.isArray(data?.languages) && data.languages.length) {
                setLanguages(data.languages);
            }
        } catch {
            setMessages({});
        }
    }, []);

    useEffect(() => {
        const prefixed = /^\/(en|de|it|es|fr)(?=\/|$)/.test(pathname || "");
        const fromPath = stripLocalePrefix(pathname || "/").locale;
        try {
            if (window.localStorage.getItem(CHOSEN) === "1") {
                const stored = window.localStorage.getItem(STORAGE);
                writeCookie(isLocale(stored) ? stored : fromPath, true);
            }
        } catch {
            /* ignore */
        }
        const chosen = hasChosenLocaleCookie();
        if (!chosen && prefixed) {
            const stripped = stripLocalePrefix(pathname || "/").path;
            const nextUrl = `${stripped}${window.location.search}${window.location.hash}`;
            window.history.replaceState(window.history.state, "", nextUrl);
        }
        const next =
            chosen && prefixed && isLocale(fromPath)
                ? fromPath
                : isLocale(initialLocale)
                  ? initialLocale
                  : DEFAULT_LOCALE;
        if (next !== locale) setLocaleState(next);
        try {
            window.localStorage.setItem(STORAGE, next);
            writeCookie(next, chosen);
        } catch {
            /* ignore */
        }
        document.documentElement.lang = next;
        void loadCatalog(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, initialLocale]);

    const setLocale = useCallback(
        async (next: string) => {
            const loc = isLocale(next) ? next : DEFAULT_LOCALE;
            setLocaleState(loc);
            try {
                window.localStorage.setItem(STORAGE, loc);
                window.localStorage.setItem(CHOSEN, "1");
                writeCookie(loc, true);
            } catch {
                /* ignore */
            }
            document.documentElement.lang = loc;
            await loadCatalog(loc);
            if (user) {
                await apiFetch("/auth/profile", {
                    method: "PATCH",
                    body: JSON.stringify({ locale: loc }),
                }).catch(() => undefined);
            }
            const path = pathname || "/";
            const { path: stripped } = stripLocalePrefix(path);
            const nextPath = withLocalePrefix(stripped, loc);
            if (nextPath !== path) router.replace(nextPath);
        },
        [loadCatalog, pathname, router, user],
    );

    const t = useCallback(
        (key: string) => {
            if (catalogLocale === locale && messages[key]) return messages[key];
            return translate(key, locale);
        },
        [catalogLocale, locale, messages],
    );

    const value = useMemo(
        () => ({
            locale,
            languages,
            t,
            setLocale,
            formatMoney: (amount: number) => formatMoney(amount, locale),
            formatDateTime: (value: string | Date | null | undefined) => formatDateTime(value, locale),
        }),
        [languages, locale, setLocale, t],
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
    return useContext(I18nContext);
}

export function useLocalePath(href: string) {
    const { locale } = useT();
    return withLocalePrefix(href, locale);
}
