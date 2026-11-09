import { detectLocale } from "./messages";

describe("detectLocale", () => {
    it('picks fr from "fr-FR,fr;q=0.9,en;q=0.8"', () => {
        expect(detectLocale("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
    });

    it('skips unsupported ja and uses en from "ja,en;q=0.5"', () => {
        expect(detectLocale("ja,en;q=0.5")).toBe("en");
    });

    it('falls back to en for "ja"', () => {
        expect(detectLocale("ja")).toBe("en");
    });

    it('picks hu from "hu-HU,hu;q=0.9"', () => {
        expect(detectLocale("hu-HU,hu;q=0.9")).toBe("hu");
    });

    it('maps es-AR to es', () => {
        expect(detectLocale("es-AR")).toBe("es");
    });

    it('maps de to de', () => {
        expect(detectLocale("de")).toBe("de");
    });

    it('falls back to en for Portuguese', () => {
        expect(detectLocale("pt-BR,pt;q=0.9")).toBe("en");
    });

    it("falls back to en for empty or missing headers", () => {
        expect(detectLocale("")).toBe("en");
        expect(detectLocale(null)).toBe("en");
        expect(detectLocale(undefined)).toBe("en");
    });

    it("does not match a locale by includes() on the whole header", () => {
        expect(detectLocale("en;q=0.1,fr;q=0.9")).toBe("fr");
    });
});
