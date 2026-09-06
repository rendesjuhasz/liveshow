"use client";

import { useT } from "@/lib/i18n/I18nProvider";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
    const { locale, languages, setLocale, t } = useT();
    return (
        <label className={compact ? "inline-flex items-center gap-2 text-xs text-zinc-300" : "grid gap-1 text-sm"}>
            {!compact && t("nav.language")}
            <select
                aria-label={t("nav.language")}
                className="h-11 max-w-[9.5rem] rounded-xl border border-white/10 bg-black px-2 text-base text-white md:h-9 md:max-w-none md:text-sm"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
            >
                {languages
                    .filter((lang) => lang.enabled !== false)
                    .map((lang) => (
                        <option key={lang.code} value={lang.code}>
                            {lang.nativeName}
                        </option>
                    ))}
            </select>
        </label>
    );
}
