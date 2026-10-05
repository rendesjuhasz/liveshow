import { ForbiddenException } from "@nestjs/common";
import type { Request } from "express";
import {
    barionIpAllowlist,
    barionWebhookSecret,
    hmacHex,
    safeEqualHex,
} from "../auth/secrets";
import { clientKey } from "../security/rate-limit";

function signatureOf(req: Request) {
    const header = String(
        req.headers["x-liveshow-barion-signature"] || req.headers["x-barion-signature"] || "",
    ).trim();
    if (header) return header.replace(/^sha256=/i, "");
    const q = req.query || {};
    const fromQuery = q.sig || q.signature || q.hmac;
    return String(Array.isArray(fromQuery) ? fromQuery[0] : fromQuery || "").trim();
}

export function assertBarionWebhook(req: Request, paymentId: string) {
    const secret = barionWebhookSecret();
    const allow = barionIpAllowlist();
    if (!secret && allow.length === 0) {
        if (process.env.NODE_ENV === "production") {
            throw new ForbiddenException("A Barion webhook nincs hitelesítve.");
        }
        return;
    }

    let ok = false;
    if (secret) {
        const provided = signatureOf(req);
        const expected = hmacHex(secret, String(paymentId || "").trim());
        if (provided && safeEqualHex(provided.toLowerCase(), expected.toLowerCase())) {
            ok = true;
        }
    }
    if (allow.length) {
        const ip = clientKey(req);
        if (allow.includes(ip)) ok = true;
    }

    if (!ok) {
        throw new ForbiddenException("Érvénytelen Barion webhook hitelesítés.");
    }
}
