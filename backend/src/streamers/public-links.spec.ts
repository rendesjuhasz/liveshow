import { parseAndValidatePublicLinks, readStoredPublicLinks } from "./public-links";

describe("public links", () => {
    it("accepts https social and website links up to 5", () => {
        const rows = parseAndValidatePublicLinks([
            { label: "YouTube", url: "https://www.youtube.com/@demo" },
            { label: "Instagram", url: "https://instagram.com/demo" },
            { label: "Web", url: "https://example.com/about" },
        ]);
        expect(rows).toHaveLength(3);
        expect(rows[0].url).toContain("youtube.com");
    });

    it("accepts Discord invite hosts", () => {
        const a = parseAndValidatePublicLinks([{ label: "Discord", url: "https://discord.gg/abcdef" }]);
        const b = parseAndValidatePublicLinks([{ label: "Discord", url: "https://discord.com/invite/abcdef" }]);
        expect(a[0].url).toContain("discord.gg");
        expect(b[0].url).toContain("/invite/");
    });

    it("rejects discord user and channel deep links", () => {
        expect(() =>
            parseAndValidatePublicLinks([{ label: "DM", url: "https://discord.com/users/123" }]),
        ).toThrow();
        expect(() =>
            parseAndValidatePublicLinks([{ label: "Ch", url: "https://discord.com/channels/1/2" }]),
        ).toThrow();
    });

    it("rejects messengers, telegram, mailto and shorteners", () => {
        const bad = [
            "https://wa.me/36123456789",
            "https://t.me/someone",
            "https://bit.ly/x",
            "http://example.com",
            "javascript:alert(1)",
        ];
        for (const url of bad) {
            expect(() => parseAndValidatePublicLinks([{ label: "x", url }])).toThrow();
        }
    });

    it("rejects more than 5 links", () => {
        const rows = Array.from({ length: 6 }, (_, i) => ({
            label: `L${i}`,
            url: `https://example.com/p${i}`,
        }));
        expect(() => parseAndValidatePublicLinks(rows)).toThrow();
    });

    it("skips empty pairs and parses JSON strings", () => {
        const rows = parseAndValidatePublicLinks(
            JSON.stringify([{ label: "", url: "" }, { label: "YT", url: "https://youtu.be/abc" }]),
        );
        expect(rows).toEqual([{ label: "YT", url: "https://youtu.be/abc" }]);
    });

    it("readStoredPublicLinks never throws", () => {
        expect(readStoredPublicLinks("not-json")).toEqual([]);
        expect(readStoredPublicLinks(null)).toEqual([]);
        expect(readStoredPublicLinks([{ label: "A", url: "https://example.com" }])[0].label).toBe("A");
    });
});
