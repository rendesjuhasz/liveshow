import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";

@Injectable()
export class TokenService {
    generateStreamToken(streamId: string, expiresInSeconds: number, userId: string) {
        const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
        const uid = String(userId || "").trim();
        return {
            streamId,
            userId: uid,
            token: this.sign(streamId, expiresAt, uid),
            expiresAt,
        };
    }

    validateStreamToken(streamId: string, token: string, expiresAt: number, userId?: string) {
        const uid = String(userId || "").trim();
        if (!token || !uid || !expiresAt) return false;
        const now = Math.floor(Date.now() / 1000);
        if (now > Number(expiresAt)) return false;
        const expected = this.sign(streamId, Number(expiresAt), uid);
        if (!expected) return false;
        return this.safeEqual(expected, String(token));
    }

    private hmacSecret() {
        const secret = process.env.STREAM_SECRET?.trim();
        if (secret) return secret;
        if (process.env.NODE_ENV === "production") return "";
        return "dev-secret";
    }

    private sign(streamId: string, expiresAt: number, userId: string) {
        const secret = this.hmacSecret();
        if (!secret) return "";
        return crypto
            .createHmac("sha256", secret)
            .update(`${streamId}:${expiresAt}:${userId}`)
            .digest("hex");
    }

    private safeEqual(a: string, b: string) {
        const left = Buffer.from(a);
        const right = Buffer.from(b);
        if (left.length !== right.length) return false;
        return crypto.timingSafeEqual(left, right);
    }
}
