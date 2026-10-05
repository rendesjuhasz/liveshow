import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import { streamSecret } from "../../auth/secrets";

export const HLS_LIVE_TTL_SEC = 120;
export const HLS_ARCHIVE_TTL_SEC = 300;

@Injectable()
export class TokenService {
    generateStreamToken(streamId: string, expiresInSeconds: number, userId: string, ip = "") {
        const ttl = Math.max(30, Math.min(Number(expiresInSeconds) || HLS_LIVE_TTL_SEC, HLS_ARCHIVE_TTL_SEC));
        const expiresAt = Math.floor(Date.now() / 1000) + ttl;
        const uid = String(userId || "").trim();
        return {
            streamId,
            userId: uid,
            token: this.sign(streamId, expiresAt, uid, ip),
            expiresAt,
        };
    }

    validateStreamToken(streamId: string, token: string, expiresAt: number, userId?: string, ip = "") {
        const uid = String(userId || "").trim();
        if (!token || !uid || !expiresAt) return false;
        const now = Math.floor(Date.now() / 1000);
        if (now > Number(expiresAt)) return false;
        const expected = this.sign(streamId, Number(expiresAt), uid, ip);
        if (!expected) return false;
        return this.safeEqual(expected, String(token));
    }

    encodeCookie(payload: { streamId: string; userId: string; token: string; expiresAt: number }) {
        return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    }

    decodeCookie(raw: string) {
        try {
            const json = JSON.parse(Buffer.from(String(raw || ""), "base64url").toString("utf8"));
            const streamId = String(json?.streamId || "").trim();
            const userId = String(json?.userId || "").trim();
            const token = String(json?.token || "").trim();
            const expiresAt = Number(json?.expiresAt);
            if (!streamId || !userId || !token || !expiresAt) return null;
            return { streamId, userId, token, expiresAt };
        } catch {
            return null;
        }
    }

    private sign(streamId: string, expiresAt: number, userId: string, ip: string) {
        const secret = streamSecret();
        if (!secret) return "";
        return crypto
            .createHmac("sha256", secret)
            .update(`${streamId}:${expiresAt}:${userId}:${ip}`)
            .digest("hex");
    }

    private safeEqual(a: string, b: string) {
        const left = Buffer.from(a);
        const right = Buffer.from(b);
        if (left.length !== right.length) return false;
        return crypto.timingSafeEqual(left, right);
    }
}
