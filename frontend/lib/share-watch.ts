import { DEFAULT_LOCALE } from "@/lib/i18n/messages";
import { withLocalePrefix } from "@/lib/i18n/paths";

export type WatchShareKind = "live" | "archive";

export function publicWatchSharePath(kind: WatchShareKind, id: string) {
    const clean = String(id || "").trim();
    if (!clean) return "";
    if (kind === "live") return `/live/${encodeURIComponent(clean)}`;
    return `/archive/${encodeURIComponent(clean)}`;
}

/** Nyilvános oldal URL. Nincs token, aláírás vagy extra jogosultság a linkben. */
export function publicWatchShareUrl(kind: WatchShareKind, id: string, locale: string = DEFAULT_LOCALE) {
    const path = publicWatchSharePath(kind, id);
    if (!path) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (!origin) return path;
    return `${origin}${withLocalePrefix(path, locale)}`;
}

export function shareNetworkUrl(
    network: "facebook" | "messenger" | "x" | "whatsapp",
    pageUrl: string,
) {
    const u = encodeURIComponent(pageUrl);
    if (network === "facebook") return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    if (network === "x") return `https://twitter.com/intent/tweet?url=${u}`;
    if (network === "whatsapp") return `https://api.whatsapp.com/send?text=${u}`;
    if (typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
        return `fb-messenger://share/?link=${u}`;
    }
    const appId = String(process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "").trim();
    if (appId) {
        return `https://www.facebook.com/dialog/send?app_id=${encodeURIComponent(appId)}&link=${u}&redirect_uri=${u}&display=popup`;
    }
    return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
}
