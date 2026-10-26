"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/context/AuthContext";
import SiteNav from "@/components/SiteNav";
import EmailVerifyBanner from "@/components/EmailVerifyBanner";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import CookieBanner from "@/components/CookieBanner";
import { readCookieConsent } from "@/lib/cookie-consent";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import TimezoneSync from "@/components/TimezoneSync";
import RoleDocumentTitle from "@/components/RoleDocumentTitle";
import { isHomePath, isTheaterWatchPath } from "@/lib/roles";

export default function AppShell({
    children,
    initialLocale,
    initialPath,
}: {
    children: ReactNode;
    initialLocale?: string;
    initialPath?: string;
}) {
    const pathname = usePathname();

    useLayoutEffect(() => {
        const value = readCookieConsent();
        if (value) {
            document.documentElement.setAttribute("data-cookie-consent", value);
        }
        document.documentElement.setAttribute("data-cookie-ready", "1");
        history.scrollRestoration = "manual";
        document.documentElement.style.overflowAnchor = "none";
        try {
            const drop: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith("liveshow:watch")) drop.push(k);
            }
            for (const k of drop) localStorage.removeItem(k);
        } catch {
            /* private mode */
        }
    }, []);

    useLayoutEffect(() => {
        const here = window.location.pathname;
        const theater =
            isTheaterWatchPath(here) ||
            isTheaterWatchPath(pathname) ||
            Boolean(document.querySelector("[data-live-viewer]"));
        const home = isHomePath(here) || isHomePath(pathname);
        if (theater) document.documentElement.setAttribute("data-live-watch", "1");
        else document.documentElement.removeAttribute("data-live-watch");
        if (home) document.documentElement.setAttribute("data-home", "1");
        else document.documentElement.removeAttribute("data-home");
    }, [pathname]);

    return (
        <AuthProvider>
            <I18nProvider initialLocale={initialLocale}>
                <TimezoneSync />
                <RoleDocumentTitle />
                <SiteNav initialPath={initialPath} />
                <EmailVerifyBanner />
                <MaintenanceBanner />
                <CookieBanner />
                {children}
            </I18nProvider>
        </AuthProvider>
    );
}
