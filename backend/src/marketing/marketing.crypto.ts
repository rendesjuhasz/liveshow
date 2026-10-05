import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";
import { jwtSecret } from "../auth/secrets";

function secretBytes() {
    const raw = String(process.env.MARKETING_TOKEN_SECRET || jwtSecret()).trim();
    return createHmac("sha256", "liveshow-marketing-oauth").update(raw).digest();
}

export function encryptSecret(plain: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", secretBytes(), iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(packed: string) {
    const [ivB, tagB, dataB] = String(packed || "").split(".");
    if (!ivB || !tagB || !dataB) throw new Error("Érvénytelen titok.");
    const decipher = createDecipheriv("aes-256-gcm", secretBytes(), Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    const out = Buffer.concat([decipher.update(Buffer.from(dataB, "base64url")), decipher.final()]);
    return out.toString("utf8");
}

export function signOAuthState(payload: Record<string, string>) {
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = createHmac("sha256", secretBytes()).update(body).digest("base64url");
    return `${body}.${sig}`;
}

export function readOAuthState(state: string) {
    const [body, sig] = String(state || "").split(".");
    if (!body || !sig) throw new Error("Érvénytelen OAuth state.");
    const expected = createHmac("sha256", secretBytes()).update(body).digest("base64url");
    if (expected.length !== sig.length) throw new Error("Érvénytelen OAuth state.");
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    let ok = a.length === b.length;
    if (ok) {
        for (let i = 0; i < a.length; i++) ok = ok && a[i] === b[i];
    }
    if (!ok) throw new Error("Érvénytelen OAuth state.");
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, string>;
    const exp = Number(parsed.exp || 0);
    if (!exp || Date.now() / 1000 > exp) throw new Error("Lejárt OAuth state.");
    return parsed;
}
