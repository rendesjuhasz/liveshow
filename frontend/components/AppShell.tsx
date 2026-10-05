"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import SiteNav from "@/components/SiteNav";
import EmailVerifyBanner from "@/components/EmailVerifyBanner";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import CookieBanner from "@/components/CookieBanner";
import MainPad from "@/components/layout/MainPad";
import { readCookieConsent } from "@/lib/cookie-consent";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import TimezoneSync from "@/components/TimezoneSync";
import RoleDocumentTitle from "@/components/RoleDocumentTitle";

export default function AppShell({
    children,
    initialLocale,
    initialPath,
}: {
    children: ReactNode;
    initialLocale?: string;
    initialPath?: string;
}) {
    useLayoutEffect(() => {
        const value = readCookieConsent();
        if (value) {
            document.documentElement.setAttribute("data-cookie-consent", value);
        }
        document.documentElement.setAttribute("data-cookie-ready", "1");
        history.scrollRestoration = "manual";
        document.documentElement.style.overflowAnchor = "none";
    }, []);

    return (
        <AuthProvider>
            <I18nProvider initialLocale={initialLocale}>
                <div>
                    <TimezoneSync />
                    <RoleDocumentTitle />
                    <SiteNav initialPath={initialPath} />
                    <EmailVerifyBanner />
                    <MaintenanceBanner />
                    <CookieBanner />
                    <MainPad>{children}</MainPad>
                </div>
            </I18nProvider>
        </AuthProvider>
    );
}
