import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Outfit } from "next/font/google";
import "./globals.css";
import AppShell from "../components/AppShell";
import SiteFooter from "../components/SiteFooter";
import ConditionalFooter from "../components/ConditionalFooter";
import { DEFAULT_LOCALE, isLocale } from "../lib/i18n/messages";
import { metadataForPath, siteUrl } from "../lib/seo";

const outfit = Outfit({
    subsets: ["latin", "latin-ext"],
    variable: "--font-outfit",
});

export async function generateMetadata(): Promise<Metadata> {
    const page = await metadataForPath("/", DEFAULT_LOCALE);
    return {
        metadataBase: new URL(siteUrl()),
        ...page,
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
    themeColor: "#1E1E1E",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
    const hdr = await headers();
    const fromHeader = hdr.get("x-locale");
    const locale = isLocale(fromHeader) ? fromHeader : DEFAULT_LOCALE;
    const path = hdr.get("x-liveshow-path") || "/";
    const nonce = hdr.get("x-nonce") || undefined;
    return (
        <html lang={locale} className={outfit.variable} suppressHydrationWarning>
            <body className="min-h-dvh bg-background font-sans antialiased" data-csp-nonce={nonce}>
                <div className="flex min-h-dvh flex-col">
                    <div className="flex-1">
                        <AppShell initialLocale={locale} initialPath={path}>
                            {children}
                        </AppShell>
                    </div>
                    <ConditionalFooter>
                        <SiteFooter locale={locale} />
                    </ConditionalFooter>
                </div>
            </body>
        </html>
    );
}
