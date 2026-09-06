"use client";

import LocaleLink from "./LocaleLink";
import { LEGAL_PAGES } from "./LegalShell";
import { useT } from "@/lib/i18n/I18nProvider";

const LEGAL_KEYS: Record<string, string> = {
    "/aszf": "legal.aszf",
    "/adatkezeles": "legal.privacy",
    "/faq": "legal.faq",
    "/kapcsolat": "legal.contact",
};

export default function SiteFooter() {
    const { t } = useT();
    return (
        <footer className="border-t border-white/10 bg-black px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-zinc-500 sm:px-6 sm:py-12">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <p className="text-lg font-black text-white">
                    Live<span className="text-accent">Show</span>
                </p>
                <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {LEGAL_PAGES.map((page) => (
                        <LocaleLink key={page.href} href={page.href} className="hover:text-white">
                            {LEGAL_KEYS[page.href] ? t(LEGAL_KEYS[page.href]) : page.title}
                        </LocaleLink>
                    ))}
                    <LocaleLink href="/streamer-login" className="hover:text-white">
                        {t("nav.streamerLogin")}
                    </LocaleLink>
                </nav>
                <p className="text-xs">© {new Date().getFullYear()}</p>
            </div>
        </footer>
    );
}
