import {
    groupShowTranslations,
    localizeShowCopy,
    normalizeShowTranslations,
    persistShowContentTranslations,
    resolveOriginalLocale,
} from "./show-content-translations";

describe("show content translations", () => {
    it("resolves originalLocale to hu when missing or invalid, and keeps a valid code", () => {
        expect(resolveOriginalLocale(undefined)).toBe("hu");
        expect(resolveOriginalLocale("")).toBe("hu");
        expect(resolveOriginalLocale("xx")).toBe("hu");
        expect(resolveOriginalLocale("en")).toBe("en");
    });

    it("drops the original locale and unknown locales so the canonical title stays on Show", () => {
        const rows = normalizeShowTranslations(
            [
                { locale: "hu", title: "Magyar" },
                { locale: "en", title: "English" },
                { locale: "xx", title: "Nope" },
            ],
            "hu",
        );
        expect(rows).toEqual([{ locale: "en", title: "English", description: undefined }]);
    });

    it("keeps Hungarian rows when the original language is not Hungarian", () => {
        const rows = normalizeShowTranslations(
            [
                { locale: "en", title: "English original" },
                { locale: "hu", title: "Magyar" },
            ],
            "en",
        );
        expect(rows).toEqual([{ locale: "hu", title: "Magyar", description: undefined }]);
    });

    it("groups stored rows without inventing machine translations", () => {
        const grouped = groupShowTranslations(
            [
                { locale: "en", field: "title", value: "Hello" },
                { locale: "hu", field: "title", value: "ignored" },
            ],
            "hu",
        );
        expect(grouped.find((row) => row.locale === "en")?.title).toBe("Hello");
        expect(grouped.find((row) => row.locale === "de")?.title).toBe("");
        expect(grouped.some((row) => row.locale === "hu")).toBe(false);
    });

    it("writes only provided locales and deletes empty values and the original locale", async () => {
        const prisma = { $executeRaw: jest.fn().mockResolvedValue(1) };
        await persistShowContentTranslations(
            prisma,
            "show-1",
            [{ locale: "en", title: "Hello", description: "" }],
            "hu",
        );
        const sql = prisma.$executeRaw.mock.calls.map((call) => String(call[0]?.join?.(" ") || call[0]));
        expect(sql.some((chunk) => chunk.includes("INSERT INTO"))).toBe(true);
        expect(sql.filter((chunk) => chunk.includes("DELETE FROM")).length).toBeGreaterThanOrEqual(2);
        expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it("overlays a saved translation only when the viewer language differs from the original", () => {
        const show = { title: "Eredeti", description: "Leírás", originalLocale: "hu" };
        const withHit = localizeShowCopy(show, "en", { title: "English" });
        expect(withHit.title).toBe("English");
        expect(withHit.contentTranslated).toBe(true);
        const sameLang = localizeShowCopy(show, "hu", { title: "English" });
        expect(sameLang.title).toBe("Eredeti");
        expect(sameLang.contentTranslated).toBe(false);
        const missing = localizeShowCopy(show, "de", {});
        expect(missing.title).toBe("Eredeti");
        expect(missing.contentTranslated).toBe(false);
    });
});
