import { generateTotpSecret, totpAt, verifyTotp } from "./totp";

describe("TOTP helpers", () => {
    it("verifies a code from the current window", () => {
        const secret = generateTotpSecret();
        const code = totpAt(secret);
        expect(verifyTotp(secret, code)).toBe(true);
        expect(verifyTotp(secret, "000000")).toBe(false);
    });
});
