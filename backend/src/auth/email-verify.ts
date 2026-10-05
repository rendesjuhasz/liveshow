import { createHash, randomBytes } from "crypto";

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const EMAIL_NOT_VERIFIED_MESSAGE =
    "Erősítsd meg az e-mail címed. A linket elküldtük a postaládádba.";
export const VERIFY_TOKEN_INVALID_MESSAGE =
    "A megerősítő link érvénytelen vagy lejárt.";
export const RESEND_VERIFY_MESSAGE =
    "Ha a fiók létezik és még nincs megerősítve, küldtünk egy új linket.";

export function createVerifyToken() {
    return randomBytes(32).toString("base64url");
}

export function hashVerifyToken(token: string) {
    return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

export function verifyExpiryDate(now = Date.now()) {
    return new Date(now + EMAIL_VERIFY_TTL_MS);
}

export function isVerifyExpired(expiresAt: Date | string | null | undefined, now = Date.now()) {
    if (!expiresAt) return true;
    return new Date(expiresAt).getTime() <= now;
}
