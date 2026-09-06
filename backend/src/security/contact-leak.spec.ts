import { findOffPlatformContact } from "./contact-leak";

describe("findOffPlatformContact", () => {
    it("detects emails and obfuscation", () => {
        expect(findOffPlatformContact("írj ide: anna@example.com")).toBe("email");
        expect(findOffPlatformContact("anna kukac gmail pont com")).toBe("email");
    });

    it("detects Hungarian phones and WhatsApp links", () => {
        expect(findOffPlatformContact("hívj: +36 20 123 4567")).toBe("phone");
        expect(findOffPlatformContact("06-30-111-2233")).toBe("phone");
        expect(findOffPlatformContact("wa.me/36201234567")).toBe("url");
    });

    it("detects off-platform channels", () => {
        expect(findOffPlatformContact("telegram: @valaki")).toBe("channel");
        expect(findOffPlatformContact("https://t.me/valaki")).toBe("url");
    });

    it("allows normal show talk", () => {
        expect(findOffPlatformContact("Mikor lesz a következő 90 perces műsor 5000 Ft-ért?")).toBeNull();
        expect(findOffPlatformContact("Kezdés 20:30-kor.")).toBeNull();
    });
});
