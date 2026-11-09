"use client";

import { useT } from "@/lib/i18n/I18nProvider";
import { shouldShowOriginalLanguageBadge } from "@/lib/original-language-badge";

export { shouldShowOriginalLanguageBadge };

export default function OriginalLanguageBadge({
    originalLocale,
    contentTranslated,
}: {
    originalLocale?: string | null;
    contentTranslated?: boolean | null;
}) {
    const { t, locale } = useT();
    if (!shouldShowOriginalLanguageBadge(originalLocale, locale, contentTranslated)) return null;
    return (
        <span
            className="inline-flex shrink-0 items-center rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/90"
            title={t("content.originalLanguage")}
        >
            {String(originalLocale || "hu").toUpperCase()}
        </span>
    );
}
