import { FALLBACK_GUEST_LOCALE, MESSAGES, MISSING_MESSAGE_FALLBACK, translate, type Locale } from "./messages";

describe("translate fallback", () => {
    const key = "__audit.translateFallback";
    const original = MESSAGES[key];

    afterEach(() => {
        if (original) MESSAGES[key] = original;
        else delete MESSAGES[key];
    });

    it("uses requested language, then en, then hu", () => {
        MESSAGES[key] = {
            hu: "HU",
            en: "EN",
            de: "DE",
            it: "",
            es: "   ",
            fr: "",
        };
        expect(translate(key, "de")).toBe("DE");
        expect(translate(key, "it")).toBe("EN");
        expect(translate(key, "es")).toBe("EN");
        MESSAGES[key].en = "";
        expect(translate(key, "fr")).toBe("HU");
    });

    it("never returns the raw key", () => {
        expect(translate("definitely.not.in.dictionary", "fr")).toBe(MISSING_MESSAGE_FALLBACK);
        expect(translate("definitely.not.in.dictionary", "fr")).not.toBe("definitely.not.in.dictionary");
    });

    it("falls back to en when locale is unsupported", () => {
        const sample = Object.keys(MESSAGES)[0];
        const row = MESSAGES[sample];
        const expected = row[FALLBACK_GUEST_LOCALE as Locale] || row.hu;
        expect(translate(sample, "ja")).toBe(expected);
    });
});
