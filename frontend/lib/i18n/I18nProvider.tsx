"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import {
    DEFAULT_LOCALE,
    FALLBACK_GUEST_LOCALE,
    formatDateTime,
    formatMoney,
    formatNumber,
    isLocale,
    LOCALE_META,
    LOCALES,
    translate,
    type Locale,
} from "./messages";
import { stripLocalePrefix, withLocalePrefix } from "./paths";
import {
    hasExplicitLocaleChoice,
    LOCALE_CHOSEN_COOKIE,
    LOCALE_COOKIE,
    readLocaleCookie,
} from "./locale-choice";

const STORAGE = LOCALE_COOKIE;
const CHOSEN = LOCALE_CHOSEN_COOKIE;

type Lang = { code: string; name: string; nativeName: string; enabled?: boolean };

type I18nContextType = {
    locale: string;
    languages: Lang[];
    t: (key: string) => string;
    setLocale: (next: string) => Promise<void>;
    formatMoney: (amount: number) => string;
    formatNumber: (value: number) => string;
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
    formatNumber: (value) => formatNumber(value, DEFAULT_LOCALE),
    formatDateTime: (value) => formatDateTime(value, DEFAULT_LOCALE),
});

function writeCookie(locale: string, chosen = false) {
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=31536000; SameSite=Lax${secure}`;
    if (chosen) {
        document.cookie = `${LOCALE_CHOSEN_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax${secure}`;
    }
}

function readStoredLocale(): string | null {
    try {
        const fromStorage = window.localStorage.getItem(STORAGE);
        if (isLocale(fromStorage)) return fromStorage;
    } catch {
        /* ignore */
    }
    const fromCookie = readLocaleCookie();
    return isLocale(fromCookie) ? fromCookie : null;
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
    const { user, ready } = useAuth();
    // Locale-prefixed URLs are rewritten to unprefixed routes (next.config). On the
    // server `usePathname()` is the rewritten path (`/forgot-password`); in the
    // browser it is `/en/forgot-password`. Prefer the URL prefix, else middleware
    // `x-locale` (initialLocale), so SSR and hydration use the same language.
    const pathHasLocalePrefix = /^\/(en|de|it|es|fr)(?=\/|$)/.test(pathname || "");
    const pathLocale = stripLocalePrefix(pathname || "/").locale;
    const resolvedLocale = (
        pathHasLocalePrefix && isLocale(pathLocale)
            ? pathLocale
            : isLocale(initialLocale)
              ? initialLocale
              : FALLBACK_GUEST_LOCALE
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
    const accountLocaleRef = useRef<string | null>(null);

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

    const applyUiLocale = useCallback(
        (next: string, persistChosen: boolean) => {
            const loc = isLocale(next) ? next : FALLBACK_GUEST_LOCALE;
            setLocaleState(loc);
            try {
                window.localStorage.setItem(STORAGE, loc);
                if (persistChosen) window.localStorage.setItem(CHOSEN, "1");
                writeCookie(loc, persistChosen);
            } catch {
                /* ignore */
            }
            document.documentElement.lang = loc;
            void loadCatalog(loc);
            return loc;
        },
        [loadCatalog],
    );

    useEffect(() => {
        const prefixed = /^\/(en|de|it|es|fr)(?=\/|$)/.test(pathname || "");
        const fromPath = stripLocalePrefix(pathname || "/").locale;
        const chosen = hasExplicitLocaleChoice();
        try {
            if (window.localStorage.getItem(CHOSEN) === "1") {
                const stored = readStoredLocale() || fromPath;
                writeCookie(isLocale(stored) ? stored : fromPath, true);
            }
        } catch {
            /* ignore */
        }
        const stored = readStoredLocale();
        let next: string;
        if (prefixed && isLocale(fromPath)) {
            next = fromPath;
        } else if (chosen && isLocale(stored)) {
            next = stored;
        } else if (accountLocaleRef.current && isLocale(accountLocaleRef.current)) {
            next = accountLocaleRef.current;
        } else if (isLocale(initialLocale)) {
            next = initialLocale;
        } else {
            next = FALLBACK_GUEST_LOCALE;
        }
        if (next !== locale) setLocaleState(next);
        try {
            if (chosen && isLocale(stored)) {
                window.localStorage.setItem(STORAGE, stored);
                writeCookie(stored, true);
            } else {
                writeCookie(next, false);
            }
        } catch {
            /* ignore */
        }
        document.documentElement.lang = next;
        void loadCatalog(next);
        if (chosen && isLocale(stored) && !prefixed && stored !== DEFAULT_LOCALE) {
            const { path: stripped } = stripLocalePrefix(pathname || "/");
            const nextPath = withLocalePrefix(stripped, stored);
            if (nextPath !== (pathname || "/")) router.replace(nextPath);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, initialLocale]);

    useEffect(() => {
        if (!ready) return;
        if (!user) {
            accountLocaleRef.current = null;
            return;
        }
        const account = user.locale;
        if (!isLocale(account)) return;
        accountLocaleRef.current = account;
        if (hasExplicitLocaleChoice()) return;
        const prefixed = /^\/(en|de|it|es|fr)(?=\/|$)/.test(pathname || "");
        if (prefixed) return;
        if (account === locale) return;
        const loc = applyUiLocale(account, false);
        const { path: stripped } = stripLocalePrefix(pathname || "/");
        const nextPath = withLocalePrefix(stripped, loc);
        if (nextPath !== (pathname || "/")) router.replace(nextPath);
    }, [applyUiLocale, locale, pathname, ready, router, user]);

    const setLocale = useCallback(
        async (next: string) => {
            const loc = isLocale(next) ? next : DEFAULT_LOCALE;
            applyUiLocale(loc, true);
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
        [applyUiLocale, pathname, router, user],
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
            formatNumber: (value: number) => formatNumber(value, locale),
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
