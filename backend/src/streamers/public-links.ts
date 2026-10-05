import { BadRequestException } from "@nestjs/common";
import { sanitizeUserText } from "../security/sanitize-text";

export type PublicLink = { label: string; url: string };

export const PUBLIC_LINKS_MAX = 5;
const LABEL_MAX = 40;
const URL_MAX = 500;

const BLOCKED_HOSTS = [
    "wa.me",
    "whatsapp.com",
    "t.me",
    "telegram.me",
    "telegram.org",
    "m.me",
    "messenger.com",
    "signal.me",
    "signal.org",
    "snapchat.com",
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "cutt.ly",
    "ow.ly",
    "is.gd",
    "goo.gl",
    "rb.gy",
];

export const PUBLIC_LINKS_INVALID = "Érvénytelen nyilvános link. Csak https, és ne használj üzenetküldőt vagy rövidítőt.";
export const PUBLIC_LINKS_TOO_MANY = "Legfeljebb 5 nyilvános link adható meg.";

function hostOf(hostname: string) {
    return hostname.replace(/\.$/, "").toLowerCase();
}

function hostIs(host: string, listed: string) {
    return host === listed || host.endsWith(`.${listed}`);
}

function isBlockedHost(host: string) {
    return BLOCKED_HOSTS.some((listed) => hostIs(host, listed));
}

function isDiscordInvite(host: string, pathname: string) {
    const path = pathname || "/";
    if (hostIs(host, "discord.gg")) {
        return path.replace(/\/+$/, "").length > 1;
    }
    if (hostIs(host, "discord.com") || hostIs(host, "discordapp.com")) {
        return /^\/invite\/[^/]+/i.test(path);
    }
    return false;
}

function isBlockedFacebookPath(host: string, pathname: string) {
    if (!hostIs(host, "facebook.com") && !hostIs(host, "fb.com")) return false;
    return /\/messages(\/|$)/i.test(pathname) || /\/share\/sharer\.php/i.test(pathname);
}

export function canonicalizePublicUrl(raw: string) {
    const trimmed = String(raw || "").trim();
    if (!trimmed || trimmed.length > URL_MAX) {
        throw new BadRequestException(PUBLIC_LINKS_INVALID);
    }
    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new BadRequestException(PUBLIC_LINKS_INVALID);
    }
    if (parsed.protocol !== "https:") {
        throw new BadRequestException(PUBLIC_LINKS_INVALID);
    }
    if (parsed.username || parsed.password) {
        throw new BadRequestException(PUBLIC_LINKS_INVALID);
    }
    const host = hostOf(parsed.hostname);
    if (!host || host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        throw new BadRequestException(PUBLIC_LINKS_INVALID);
    }
    if (isBlockedHost(host)) {
        throw new BadRequestException(PUBLIC_LINKS_INVALID);
    }
    if (hostIs(host, "discord.com") || hostIs(host, "discordapp.com") || hostIs(host, "discord.gg")) {
        if (!isDiscordInvite(host, parsed.pathname)) {
            throw new BadRequestException(PUBLIC_LINKS_INVALID);
        }
    }
    if (isBlockedFacebookPath(host, parsed.pathname)) {
        throw new BadRequestException(PUBLIC_LINKS_INVALID);
    }
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${path}${parsed.search}`;
}

function normalizeOne(item: unknown): PublicLink | null {
    if (!item || typeof item !== "object") {
        throw new BadRequestException(PUBLIC_LINKS_INVALID);
    }
    const rec = item as { label?: unknown; url?: unknown };
    const label = sanitizeUserText(rec.label, LABEL_MAX);
    const urlRaw = String(rec.url ?? "").trim();
    if (!label && !urlRaw) return null;
    if (!label || !urlRaw) {
        throw new BadRequestException(PUBLIC_LINKS_INVALID);
    }
    return { label, url: canonicalizePublicUrl(urlRaw) };
}

export function parseAndValidatePublicLinks(raw: unknown): PublicLink[] {
    let value: unknown = raw;
    if (value == null || value === "") return [];
    if (typeof value === "string") {
        try {
            value = JSON.parse(value);
        } catch {
            throw new BadRequestException(PUBLIC_LINKS_INVALID);
        }
    }
    if (!Array.isArray(value)) {
        throw new BadRequestException(PUBLIC_LINKS_INVALID);
    }
    if (value.length > PUBLIC_LINKS_MAX) {
        throw new BadRequestException(PUBLIC_LINKS_TOO_MANY);
    }
    const out: PublicLink[] = [];
    const seen = new Set<string>();
    for (const item of value) {
        const one = normalizeOne(item);
        if (!one) continue;
        const key = one.url.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(one);
        if (out.length > PUBLIC_LINKS_MAX) {
            throw new BadRequestException(PUBLIC_LINKS_TOO_MANY);
        }
    }
    return out;
}

export function readStoredPublicLinks(raw: unknown): PublicLink[] {
    try {
        return parseAndValidatePublicLinks(raw);
    } catch {
        if (!Array.isArray(raw)) return [];
        const out: PublicLink[] = [];
        for (const item of raw) {
            try {
                const one = normalizeOne(item);
                if (one) out.push(one);
            } catch {
                /* skip broken row */
            }
            if (out.length >= PUBLIC_LINKS_MAX) break;
        }
        return out;
    }
}
