import { BadRequestException } from "@nestjs/common";
import { publicBackendUrl } from "../auth/public-url";
import { decryptSecret, encryptSecret } from "./marketing.crypto";

export type SocialProvider = "facebook" | "linkedin" | "x";

export function asProvider(value: string): SocialProvider {
    const v = String(value || "").toLowerCase();
    if (v === "facebook" || v === "linkedin" || v === "x" || v === "twitter") {
        return v === "twitter" ? "x" : v;
    }
    throw new BadRequestException("Ismeretlen közösségi csatorna.");
}

function backendUrl() {
    return publicBackendUrl();
}

export function oauthCallbackUrl(provider: SocialProvider) {
    return `${backendUrl()}/ai/marketing-kit/oauth/${provider}/callback`;
}

export function facebookAuthUrl(state: string) {
    const id = String(process.env.FACEBOOK_APP_ID || "").trim();
    if (!id) throw new BadRequestException("FACEBOOK_APP_ID hiányzik.");
    const u = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    u.searchParams.set("client_id", id);
    u.searchParams.set("redirect_uri", oauthCallbackUrl("facebook"));
    u.searchParams.set("state", state);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "pages_show_list,pages_read_engagement,pages_manage_posts,public_profile");
    return u.toString();
}

export function linkedinAuthUrl(state: string) {
    const id = String(process.env.LINKEDIN_CLIENT_ID || "").trim();
    if (!id) throw new BadRequestException("LINKEDIN_CLIENT_ID hiányzik.");
    const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", id);
    u.searchParams.set("redirect_uri", oauthCallbackUrl("linkedin"));
    u.searchParams.set("state", state);
    u.searchParams.set("scope", "openid profile w_member_social");
    return u.toString();
}

export function xAuthUrl(state: string, codeChallenge: string) {
    const id = String(process.env.X_CLIENT_ID || "").trim();
    if (!id) throw new BadRequestException("X_CLIENT_ID hiányzik.");
    const u = new URL("https://twitter.com/i/oauth2/authorize");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", id);
    u.searchParams.set("redirect_uri", oauthCallbackUrl("x"));
    u.searchParams.set("scope", "tweet.write tweet.read users.read offline.access");
    u.searchParams.set("state", state);
    u.searchParams.set("code_challenge", codeChallenge);
    u.searchParams.set("code_challenge_method", "S256");
    return u.toString();
}

async function readJson(res: Response) {
    return (await res.json().catch(() => ({}))) as Record<string, any>;
}

export async function exchangeFacebookCode(code: string) {
    const id = String(process.env.FACEBOOK_APP_ID || "").trim();
    const secret = String(process.env.FACEBOOK_APP_SECRET || "").trim();
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", id);
    tokenUrl.searchParams.set("client_secret", secret);
    tokenUrl.searchParams.set("redirect_uri", oauthCallbackUrl("facebook"));
    tokenUrl.searchParams.set("code", code);
    const tokRes = await fetch(tokenUrl);
    const tok = await readJson(tokRes);
    if (!tokRes.ok || !tok.access_token) {
        throw new BadRequestException(tok.error?.message || "Facebook token csere sikertelen.");
    }
    const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${encodeURIComponent(tok.access_token)}`,
    );
    const pages = await readJson(pagesRes);
    const page = pages.data?.[0];
    if (!page?.access_token || !page.id) {
        throw new BadRequestException("Nincs Facebook Page a fiókhoz. Hozz létre oldalt, vagy adj Page jogosultságot.");
    }
    return {
        accountId: String(page.id),
        accountName: String(page.name || "Facebook Page"),
        tokenEnc: encryptSecret(String(page.access_token)),
        refreshEnc: null as string | null,
        expiresAt: null as Date | null,
        meta: { userTokenStored: false },
    };
}

export async function exchangeLinkedInCode(code: string) {
    const id = String(process.env.LINKEDIN_CLIENT_ID || "").trim();
    const secret = String(process.env.LINKEDIN_CLIENT_SECRET || "").trim();
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: oauthCallbackUrl("linkedin"),
        client_id: id,
        client_secret: secret,
    });
    const tokRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const tok = await readJson(tokRes);
    if (!tokRes.ok || !tok.access_token) {
        throw new BadRequestException(tok.error_description || "LinkedIn token csere sikertelen.");
    }
    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const me = await readJson(meRes);
    const sub = String(me.sub || me.id || "").trim();
    if (!sub) throw new BadRequestException("LinkedIn profilazonosító hiányzik.");
    const expires = tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000) : null;
    return {
        accountId: sub,
        accountName: String(me.name || "LinkedIn"),
        tokenEnc: encryptSecret(String(tok.access_token)),
        refreshEnc: tok.refresh_token ? encryptSecret(String(tok.refresh_token)) : null,
        expiresAt: expires,
        meta: { urn: `urn:li:person:${sub}` },
    };
}

export async function exchangeXCode(code: string, verifier: string) {
    const id = String(process.env.X_CLIENT_ID || "").trim();
    const secret = String(process.env.X_CLIENT_SECRET || "").trim();
    const basic = Buffer.from(`${id}:${secret}`).toString("base64");
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: oauthCallbackUrl("x"),
        code_verifier: verifier,
        client_id: id,
    });
    const tokRes = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
    const tok = await readJson(tokRes);
    if (!tokRes.ok || !tok.access_token) {
        throw new BadRequestException(tok.error_description || tok.error || "X token csere sikertelen.");
    }
    const meRes = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const me = await readJson(meRes);
    const uid = String(me.data?.id || "").trim();
    if (!uid) throw new BadRequestException("X felhasználó azonosító hiányzik.");
    const expires = tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000) : null;
    return {
        accountId: uid,
        accountName: String(me.data?.username || "X"),
        tokenEnc: encryptSecret(String(tok.access_token)),
        refreshEnc: tok.refresh_token ? encryptSecret(String(tok.refresh_token)) : null,
        expiresAt: expires,
        meta: { username: me.data?.username || "" },
    };
}

export async function publishFacebook(tokenEnc: string, pageId: string, message: string) {
    const token = decryptSecret(tokenEnc);
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, access_token: token }),
    });
    const data = await readJson(res);
    if (!res.ok || !data.id) {
        throw new Error(data.error?.message || `Facebook poszt sikertelen (${res.status})`);
    }
    return String(data.id);
}

export async function publishLinkedIn(tokenEnc: string, personUrn: string, text: string) {
    const token = decryptSecret(tokenEnc);
    const urn = personUrn.startsWith("urn:") ? personUrn : `urn:li:person:${personUrn}`;
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
            author: urn,
            lifecycleState: "PUBLISHED",
            specificContent: {
                "com.linkedin.ugc.ShareContent": {
                    shareCommentary: { text },
                    shareMediaCategory: "NONE",
                },
            },
            visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
        }),
    });
    const data = await readJson(res);
    if (!res.ok) {
        throw new Error(data.message || data.error || `LinkedIn poszt sikertelen (${res.status})`);
    }
    return String(data.id || res.headers.get("x-restli-id") || "linkedin");
}

export async function publishX(tokenEnc: string, text: string) {
    const token = decryptSecret(tokenEnc);
    const res = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text.slice(0, 280) }),
    });
    const data = await readJson(res);
    if (!res.ok || !data.data?.id) {
        throw new Error(data.detail || data.title || `X poszt sikertelen (${res.status})`);
    }
    return String(data.data.id);
}
