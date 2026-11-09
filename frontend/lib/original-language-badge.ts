import { isLocale } from "./i18n/messages";

export function shouldShowOriginalLanguageBadge(
    originalLocale?: string | null,
    viewerLocale?: string | null,
    contentTranslated?: boolean | null,
) {
    const original = String(originalLocale || "hu").toLowerCase();
    const viewer = String(viewerLocale || "").toLowerCase();
    if (!isLocale(original) || !viewer || viewer === original) return false;
    return contentTranslated !== true;
}
