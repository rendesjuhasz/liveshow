import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";
import { jwtSecret } from "./secrets";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer) {
    let bits = 0;
    let value = 0;
    let out = "";
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += BASE32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
    return out;
}

export function base32Decode(input: string) {
    const clean = String(input || "")
        .toUpperCase()
        .replace(/=+$/g, "")
        .replace(/[^A-Z2-7]/g, "");
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of clean) {
        const idx = BASE32.indexOf(ch);
        if (idx < 0) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

export function generateTotpSecret() {
    return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number) {
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buf.writeUInt32BE(counter >>> 0, 4);
    const hmac = createHmac("sha1", secret).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
    return String(code % 1_000_000).padStart(6, "0");
}

export function totpAt(secretB32: string, atMs = Date.now(), step = 30) {
    const secret = base32Decode(secretB32);
    const counter = Math.floor(atMs / 1000 / step);
    return hotp(secret, counter);
}

export function verifyTotp(secretB32: string, code: string, window = 1, step = 30) {
    const expected = String(code || "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(expected)) return false;
    const now = Date.now();
    for (let i = -window; i <= window; i++) {
        const candidate = totpAt(secretB32, now + i * step * 1000, step);
        const a = Buffer.from(candidate, "utf8");
        const b = Buffer.from(expected, "utf8");
        if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
    return false;
}

function wrapKey() {
    return createHash("sha256").update(`totp:${jwtSecret()}`).digest();
}

export function encryptTotpSecret(plainB32: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", wrapKey(), iv);
    const enc = Buffer.concat([cipher.update(plainB32, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptTotpSecret(payload: string) {
    const [ivB64, tagB64, dataB64] = String(payload || "").split(".");
    if (!ivB64 || !tagB64 || !dataB64) throw new Error("Érvénytelen TOTP titok.");
    const decipher = createDecipheriv("aes-256-gcm", wrapKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function otpauthUrl(email: string, secretB32: string, issuer = "LiveShow") {
    const label = encodeURIComponent(`${issuer}:${email}`);
    const iss = encodeURIComponent(issuer);
    return `otpauth://totp/${label}?secret=${secretB32}&issuer=${iss}&digits=6&period=30`;
}
