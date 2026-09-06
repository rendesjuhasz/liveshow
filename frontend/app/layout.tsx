import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Outfit } from "next/font/google";
import "./globals.css";
import AppShell from "../components/AppShell";
import SiteFooter from "../components/SiteFooter";
import { DEFAULT_LOCALE, isLocale, translate } from "../lib/i18n/messages";
import { PREFIX_LOCALES } from "../lib/i18n/paths";

const outfit = Outfit({
    subsets: ["latin", "latin-ext"],
    variable: "--font-outfit",
});

export async function generateMetadata(): Promise<Metadata> {
    const jar = await cookies();
    const raw = jar.get("liveshow_locale")?.value;
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    const languages: Record<string, string> = { "x-default": "/", hu: "/" };
    for (const code of PREFIX_LOCALES) languages[code] = `/${code}`;
    return {
        title: translate("seo.title", locale),
        description: translate("seo.description", locale),
        alternates: { languages },
        appleWebApp: {
            capable: true,
            title: "LiveShow",
            statusBarStyle: "black-translucent",
        },
        formatDetection: { telephone: false },
    };
}

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    viewportFit: "cover",
    themeColor: "#050508",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
    const jar = await cookies();
    const raw = jar.get("liveshow_locale")?.value;
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    return (
        <html lang={locale} className={outfit.variable} suppressHydrationWarning>
            <body className="min-h-dvh bg-background font-sans antialiased">
                <AppShell initialLocale={locale}>
                    {children}
                    <SiteFooter />
                </AppShell>
            </body>
        </html>
    );
}
