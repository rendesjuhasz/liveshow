import {
    createResetToken,
    hashResetToken,
    isResetExpired,
    resetExpiryDate,
    RESET_PASSWORD_TTL_MS,
    resetTokensEqual,
} from "./password-reset";

describe("password-reset", () => {
    it("hashes tokens and compares with timing-safe equality", () => {
        const token = createResetToken();
        const hash = hashResetToken(token);
        expect(hash).toHaveLength(64);
        expect(resetTokensEqual(hash, token)).toBe(true);
        expect(resetTokensEqual(hash, "wrong-token")).toBe(false);
        expect(resetTokensEqual(null, token)).toBe(false);
    });

    it("expires after 30 minutes", () => {
        const now = Date.UTC(2026, 7, 30, 12, 0, 0);
        const expires = resetExpiryDate(now);
        expect(expires.getTime() - now).toBe(RESET_PASSWORD_TTL_MS);
        expect(isResetExpired(expires, now + RESET_PASSWORD_TTL_MS - 1)).toBe(false);
        expect(isResetExpired(expires, now + RESET_PASSWORD_TTL_MS)).toBe(true);
        expect(isResetExpired(null, now)).toBe(true);
    });
});
