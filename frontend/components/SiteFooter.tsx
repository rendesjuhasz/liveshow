import { LEGAL_PAGES } from "./LegalShell";
import { isLocale, translate, type Locale } from "@/lib/i18n/messages";
import { withLocalePrefix } from "@/lib/i18n/paths";

const LEGAL_KEYS: Record<string, string> = {
    "/aszf": "legal.aszf",
    "/adatkezeles": "legal.privacy",
    "/moderalasi-szabalyzat": "legal.moderation",
    "/jogi-nyilatkozat": "legal.notice",
    "/cookie-tajekoztato": "legal.cookies",
    "/faq": "legal.faq",
    "/kapcsolat": "legal.contact",
};

const COPYRIGHT_YEAR = 2026;

export default function SiteFooter({ locale }: { locale: string }) {
    const loc: Locale = isLocale(locale) ? locale : "hu";
    const t = (key: string) => translate(key, loc);
    return (
        <footer className="border-t border-white/5 bg-background px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-muted sm:px-6 sm:py-12">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <p className="text-lg font-black text-white">
                    Live<span className="text-accent">Show</span>
                </p>
                <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {LEGAL_PAGES.map((page) => (
                        <a key={page.href} href={withLocalePrefix(page.href, loc)} className="hover:text-white">
                            {t(LEGAL_KEYS[page.href] || "legal.aszf")}
                        </a>
                    ))}
                    <a href={withLocalePrefix("/status", loc)} className="hover:text-white">
                        {t("footer.status")}
                    </a>
                    <a href={withLocalePrefix("/streamer-login", loc)} className="hover:text-white">
                        {t("nav.streamerLogin")}
                    </a>
                </nav>
                <p className="text-xs">© {COPYRIGHT_YEAR}</p>
            </div>
        </footer>
    );
}
