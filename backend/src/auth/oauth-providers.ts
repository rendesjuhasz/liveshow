import { createSign, createPrivateKey, randomUUID } from "crypto";
import { publicFrontendUrl } from "./public-url";
import type { OAuthProvider } from "./oauth-link";

function env(name: string) {
    return String(process.env[name] || "").trim();
}

export function oauthCallbackUrl(provider: OAuthProvider) {
    return `${publicFrontendUrl()}/api/auth/oauth/${provider}/callback`;
}

export function googleConfigured() {
    return Boolean(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET"));
}

export function microsoftConfigured() {
    return Boolean(env("MICROSOFT_CLIENT_ID") && env("MICROSOFT_CLIENT_SECRET"));
}

export function appleConfigured() {
    return Boolean(
        env("APPLE_CLIENT_ID") && env("APPLE_TEAM_ID") && env("APPLE_KEY_ID") && env("APPLE_PRIVATE_KEY"),
    );
}

export function providerConfigured(provider: OAuthProvider) {
    if (provider === "google") return googleConfigured();
    if (provider === "microsoft") return microsoftConfigured();
    return appleConfigured();
}

function applePrivateKeyPem() {
    const raw = env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n");
    if (raw.includes("BEGIN")) return raw;
    return `-----BEGIN PRIVATE KEY-----\n${raw}\n-----END PRIVATE KEY-----`;
}

export function appleClientSecret() {
    const teamId = env("APPLE_TEAM_ID");
    const keyId = env("APPLE_KEY_ID");
    const clientId = env("APPLE_CLIENT_ID");
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId }), "utf8").toString("base64url");
    const payload = Buffer.from(
        JSON.stringify({
            iss: teamId,
            iat: now,
            exp: now + 60 * 60 * 24 * 120,
            aud: "https://appleid.apple.com",
            sub: clientId,
        }),
        "utf8",
    ).toString("base64url");
    const data = `${header}.${payload}`;
    const key = createPrivateKey(applePrivateKeyPem());
    const sign = createSign("SHA256");
    sign.update(data);
    sign.end();
    const sig = sign.sign({ key, dsaEncoding: "ieee-p1363" });
    return `${data}.${Buffer.from(sig).toString("base64url")}`;
}

export function authorizationUrl(provider: OAuthProvider, state: string) {
    const redirectUri = oauthCallbackUrl(provider);
    if (provider === "google") {
        const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        u.searchParams.set("client_id", env("GOOGLE_CLIENT_ID"));
        u.searchParams.set("redirect_uri", redirectUri);
        u.searchParams.set("response_type", "code");
        u.searchParams.set("scope", "openid email profile");
        u.searchParams.set("state", state);
        u.searchParams.set("prompt", "select_account");
        return u.toString();
    }
    if (provider === "microsoft") {
        const tenant = env("MICROSOFT_TENANT") || "common";
        const u = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
        u.searchParams.set("client_id", env("MICROSOFT_CLIENT_ID"));
        u.searchParams.set("redirect_uri", redirectUri);
        u.searchParams.set("response_type", "code");
        u.searchParams.set("response_mode", "query");
        u.searchParams.set("scope", "openid email profile User.Read");
        u.searchParams.set("state", state);
        return u.toString();
    }
    const u = new URL("https://appleid.apple.com/auth/authorize");
    u.searchParams.set("client_id", env("APPLE_CLIENT_ID"));
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("response_mode", "form_post");
    u.searchParams.set("scope", "name email");
    u.searchParams.set("state", state);
    return u.toString();
}

type TokenJson = {
    access_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
};

async function postForm(url: string, body: Record<string, string>) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams(body).toString(),
    });
    const json = (await res.json().catch(() => ({}))) as TokenJson;
    if (!res.ok || json.error) {
        throw new Error(String(json.error_description || json.error || "token_exchange_failed"));
    }
    return json;
}

function decodeJwtPayload(idToken: string) {
    const parts = String(idToken || "").split(".");
    if (parts.length < 2) return {} as Record<string, unknown>;
    try {
        return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
    } catch {
        return {} as Record<string, unknown>;
    }
}

function isVerifiedFlag(value: unknown) {
    return value === true || value === "true" || value === "1";
}

export type OAuthProfile = {
    provider: OAuthProvider;
    providerUserId: string;
    email: string | null;
    emailVerified: boolean;
    name: string | null;
    avatarUrl: string | null;
};

export async function fetchOAuthProfile(
    provider: OAuthProvider,
    code: string,
    appleUserJson?: string,
): Promise<OAuthProfile> {
    const redirectUri = oauthCallbackUrl(provider);
    if (provider === "google") {
        const token = await postForm("https://oauth2.googleapis.com/token", {
            code,
            client_id: env("GOOGLE_CLIENT_ID"),
            client_secret: env("GOOGLE_CLIENT_SECRET"),
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        });
        const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
            headers: { Authorization: `Bearer ${token.access_token}` },
        });
        const info = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const email = String(info.email || "").trim().toLowerCase() || null;
        return {
            provider,
            providerUserId: String(info.sub || ""),
            email,
            emailVerified: isVerifiedFlag(info.email_verified),
            name: String(info.name || "").trim() || null,
            avatarUrl: String(info.picture || "").trim() || null,
        };
    }
    if (provider === "microsoft") {
        const tenant = env("MICROSOFT_TENANT") || "common";
        const token = await postForm(
            `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
            {
                code,
                client_id: env("MICROSOFT_CLIENT_ID"),
                client_secret: env("MICROSOFT_CLIENT_SECRET"),
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
                scope: "openid email profile User.Read",
            },
        );
        const res = await fetch("https://graph.microsoft.com/oidc/userinfo", {
            headers: { Authorization: `Bearer ${token.access_token}` },
        });
        const info = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const claims = decodeJwtPayload(String(token.id_token || ""));
        const email = String(info.email || claims.email || "")
            .trim()
            .toLowerCase();
        const mail = email.includes("@") ? email : null;
        return {
            provider,
            providerUserId: String(info.sub || claims.oid || claims.sub || ""),
            email: mail,
            emailVerified: Boolean(mail),
            name: String(info.name || "").trim() || null,
            avatarUrl: null,
        };
    }
    const token = await postForm("https://appleid.apple.com/auth/token", {
        code,
        client_id: env("APPLE_CLIENT_ID"),
        client_secret: appleClientSecret(),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
    });
    const claims = decodeJwtPayload(String(token.id_token || ""));
    let name: string | null = null;
    if (appleUserJson) {
        try {
            const parsed = JSON.parse(appleUserJson) as { name?: { firstName?: string; lastName?: string } };
            name = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(" ").trim() || null;
        } catch {
            name = null;
        }
    }
    const email = String(claims.email || "").trim().toLowerCase() || null;
    return {
        provider,
        providerUserId: String(claims.sub || ""),
        email,
        emailVerified: email ? isVerifiedFlag(claims.email_verified) || true : false,
        name,
        avatarUrl: null,
    };
}

export function newOAuthNonce() {
    return randomUUID().replace(/-/g, "");
}
