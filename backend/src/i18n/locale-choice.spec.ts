import { DEFAULT_LOCALE, detectLocale, isLocale } from "./messages";

/** Same rules as frontend/lib/i18n/locale-choice.ts */
function resolvePublicLocale(
    pathLocale: string,
    cookieLocale?: string | null,
    localeChosen?: boolean,
    acceptLanguage?: string | null,
) {
    if (pathLocale !== DEFAULT_LOCALE && isLocale(pathLocale)) return pathLocale;
    if (localeChosen && isLocale(cookieLocale)) return cookieLocale;
    return detectLocale(acceptLanguage);
}

describe("resolvePublicLocale order", () => {
    it("honors URL prefix without a chosen cookie", () => {
        expect(resolvePublicLocale("en", "de", false, "hu")).toBe("en");
        expect(resolvePublicLocale("fr", null, false, "de")).toBe("fr");
    });

    it("uses an explicit cookie choice when there is no prefix", () => {
        expect(resolvePublicLocale("hu", "it", true, "de")).toBe("it");
    });

    it("does not use the locale cookie unless chosen", () => {
        expect(resolvePublicLocale("hu", "it", false, "de")).toBe("de");
    });

    it("uses Accept-Language then en for a new visitor on /", () => {
        expect(resolvePublicLocale("hu", null, false, "fr-FR,fr;q=0.9")).toBe("fr");
        expect(resolvePublicLocale("hu", null, false, "ja")).toBe("en");
        expect(resolvePublicLocale("hu", null, false, "")).toBe("en");
    });
});
