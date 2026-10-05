import { createHmac, timingSafeEqual } from "crypto";
import { jwtSecret } from "./secrets";
import { isOAuthProvider, type OAuthProvider } from "./oauth-link";

type OAuthState = {
    p: OAuthProvider;
    n: string;
    next: string;
    exp: number;
};

function b64urlJson(value: unknown) {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function sign(payload: string) {
    return createHmac("sha256", jwtSecret()).update(payload).digest("base64url");
}

export function createOAuthState(provider: OAuthProvider, nextPath: string, nonce: string) {
    const body: OAuthState = {
        p: provider,
        n: nonce,
        next: nextPath,
        exp: Date.now() + 10 * 60_000,
    };
    const payload = b64urlJson(body);
    return `${payload}.${sign(payload)}`;
}

export function readOAuthState(raw: string | undefined, expectedProvider: OAuthProvider): OAuthState {
    const token = String(raw || "").trim();
    const dot = token.lastIndexOf(".");
    if (dot < 8) throw new Error("invalid_state");
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = sign(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new Error("invalid_state");
    }
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (!isOAuthProvider(body.p) || body.p !== expectedProvider) throw new Error("invalid_state");
    if (!body.n || Number(body.exp) < Date.now()) throw new Error("invalid_state");
    return body;
}

export function safeOAuthNextPath(raw: string | null | undefined) {
    const value = String(raw || "").trim();
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return "/";
    const noHash = value.split("#")[0];
    const pathname = noHash.split("?")[0];
    if (
        pathname === "/login" ||
        pathname === "/register" ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/streamer")
    ) {
        return "/";
    }
    return noHash;
}
