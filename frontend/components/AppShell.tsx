"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import SiteNav from "@/components/SiteNav";
import CookieBanner from "@/components/CookieBanner";
import MainPad from "@/components/layout/MainPad";
import { readCookieConsent } from "@/lib/cookie-consent";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

export default function AppShell({
    children,
    initialLocale,
}: {
    children: ReactNode;
    initialLocale?: string;
}) {
    useLayoutEffect(() => {
        const value = readCookieConsent();
        if (value) {
            document.documentElement.setAttribute("data-cookie-consent", value);
        }
        document.documentElement.setAttribute("data-cookie-ready", "1");
    }, []);

    return (
        <AuthProvider>
            <I18nProvider initialLocale={initialLocale}>
            <SiteNav />
            <CookieBanner />
            <MainPad>{children}</MainPad>
            </I18nProvider>
        </AuthProvider>
    );
}
