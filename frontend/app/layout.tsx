import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Outfit } from "next/font/google";
import "./globals.css";
import AppShell from "../components/AppShell";
import MainPad from "../components/layout/MainPad";
import SiteFooter from "../components/SiteFooter";
import ConditionalFooter from "../components/ConditionalFooter";
import { DEFAULT_LOCALE, isLocale } from "../lib/i18n/messages";
import { metadataForPath, siteUrl } from "../lib/seo";
import { isHomePath, isTheaterWatchPath } from "../lib/roles";

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

export const dynamic = "force-dynamic";

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
            <html
                lang={locale}
                className={outfit.variable}
                data-live-watch={isTheaterWatchPath(path) ? "1" : undefined}
                data-home={isHomePath(path) ? "1" : undefined}
                suppressHydrationWarning
            >
            <head>
                <script
                    nonce={nonce}
                    dangerouslySetInnerHTML={{
                        __html: `(function(){function w(){try{var s=localStorage,r=[],i,k;for(i=0;i<s.length;i++){k=s.key(i);if(k&&k.indexOf("liveshow:watch")===0)r.push(k)}for(i=0;i<r.length;i++)s.removeItem(r[i])}catch(e){}}w();addEventListener("pageshow",w)})();`,
                    }}
                />
            </head>
            <body
                className="min-h-dvh bg-background font-sans antialiased"
                data-csp-nonce={nonce}
                suppressHydrationWarning
            >
                <div className="flex min-h-dvh flex-col">
                    <div className="flex-1">
                        <AppShell initialLocale={locale} initialPath={path}>
                            <MainPad>{children}</MainPad>
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
