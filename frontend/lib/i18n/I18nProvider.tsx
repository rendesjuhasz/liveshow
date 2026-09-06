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
import { getAuthToken } from "@/api/auth-storage";
import { useAuth } from "@/context/AuthContext";
import {
    DEFAULT_LOCALE,
    detectLocale,
    formatDateTime,
    formatMoney,
    isLocale,
    LOCALE_META,
    LOCALES,
    translate,
    type Locale,
} from "./messages";
import { stripLocalePrefix, withLocalePrefix } from "./paths";

const STORAGE = "liveshow_locale";
const CHOSEN = "liveshow_locale_chosen";
const COOKIE = "liveshow_locale";

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

function readCookie() {
    if (typeof document === "undefined") return "";
    const match = document.cookie.match(/(?:^|; )liveshow_locale=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : "";
}

function writeCookie(locale: string) {
    document.cookie = `${COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=31536000; SameSite=Lax`;
}

function bootstrapLocale() {
    if (typeof window === "undefined") return DEFAULT_LOCALE;
    const stored = window.localStorage.getItem(STORAGE) || readCookie();
    if (isLocale(stored)) return stored;
    if (!window.localStorage.getItem(CHOSEN)) {
        return detectLocale(navigator.language || navigator.languages?.[0]);
    }
    return DEFAULT_LOCALE;
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
    const [locale, setLocaleState] = useState<string>(
        isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE,
    );
    const [catalogLocale, setCatalogLocale] = useState<string>(
        isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE,
    );
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
        const path =
            typeof window !== "undefined" ? window.location.pathname : pathname || "/";
        const fromPath = stripLocalePrefix(path).locale;
        const initial =
            isLocale(fromPath) && fromPath !== DEFAULT_LOCALE
                ? fromPath
                : isLocale(initialLocale)
                  ? initialLocale
                  : bootstrapLocale();
        setLocaleState(initial);
        try {
            window.localStorage.setItem(STORAGE, initial);
            writeCookie(initial);
        } catch {
            /* ignore */
        }
        document.documentElement.lang = initial;
        loadCatalog(initial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!user?.locale || !isLocale(user.locale) || user.locale === locale) return;
        if (window.localStorage.getItem(CHOSEN) === "1") return;
        setLocaleState(user.locale);
        window.localStorage.setItem(STORAGE, user.locale);
        writeCookie(user.locale);
        document.documentElement.lang = user.locale;
        loadCatalog(user.locale);
    }, [user?.locale, locale, loadCatalog]);

    const setLocale = useCallback(
        async (next: string) => {
            const loc = isLocale(next) ? next : DEFAULT_LOCALE;
            setLocaleState(loc);
            try {
                window.localStorage.setItem(STORAGE, loc);
                window.localStorage.setItem(CHOSEN, "1");
                writeCookie(loc);
            } catch {
                /* ignore */
            }
            document.documentElement.lang = loc;
            await loadCatalog(loc);
            if (getAuthToken()) {
                await apiFetch("/auth/profile", {
                    method: "PATCH",
                    body: JSON.stringify({ locale: loc }),
                }).catch(() => undefined);
            }
            const path = typeof window !== "undefined" ? window.location.pathname : pathname || "/";
            const { path: stripped } = stripLocalePrefix(path);
            const nextPath = withLocalePrefix(stripped, loc);
            if (nextPath !== path) router.replace(nextPath);
        },
        [loadCatalog, pathname, router],
    );

    const t = useCallback(
        (key: string) => {
            const value =
                catalogLocale === locale && messages[key]
                    ? messages[key]
                    : translate(key, locale);
            if (value === key && typeof window !== "undefined") {
                apiFetch("/i18n/missing", {
                    method: "POST",
                    body: JSON.stringify({ key, locale }),
                }).catch(() => undefined);
            }
            return value;
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
