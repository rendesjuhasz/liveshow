import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const RESET_PASSWORD_TTL_MS = 30 * 60 * 1000;
export const FORGOT_PASSWORD_MESSAGE =
    "Ha létezik ilyen fiók, küldtünk egy helyreállító e-mailt.";
export const RESET_TOKEN_INVALID_MESSAGE =
    "A helyreállító link érvénytelen vagy lejárt.";

export function createResetToken() {
    return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string) {
    return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

export function resetTokensEqual(storedHash: string | null | undefined, incomingToken: string) {
    if (!storedHash) return false;
    const incoming = Buffer.from(hashResetToken(incomingToken), "utf8");
    const stored = Buffer.from(String(storedHash), "utf8");
    if (incoming.length !== stored.length) return false;
    return timingSafeEqual(incoming, stored);
}

export function resetExpiryDate(now = Date.now()) {
    return new Date(now + RESET_PASSWORD_TTL_MS);
}

export function isResetExpired(expiresAt: Date | string | null | undefined, now = Date.now()) {
    if (!expiresAt) return true;
    return new Date(expiresAt).getTime() <= now;
}
