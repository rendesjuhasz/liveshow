import { stripLocalePrefix } from "@/lib/i18n/paths";

function isPrivateAppPath(path: string) {
    return (
        path === "/login" ||
        path === "/register" ||
        path === "/streamer-login" ||
        path === "/streamer-register" ||
        path.startsWith("/streamer") ||
        path.startsWith("/admin") ||
        path.startsWith("/forgot-password") ||
        path.startsWith("/reset-password")
    );
}

/** Where a viewer should land after /login from the public site. */
export function safeViewerReturnPath(raw: string | null | undefined): string {
    const value = String(raw || "").trim();
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return "/";
    const noHash = value.split("#")[0];
    const pathname = noHash.split("?")[0];
    const { path } = stripLocalePrefix(pathname);
    if (!path || isPrivateAppPath(path)) return "/";
    return noHash;
}

export function viewerLoginHref(pathname: string) {
    const next = safeViewerReturnPath(pathname);
    if (next === "/") return "/login";
    const { path } = stripLocalePrefix(next.split("?")[0] || "/");
    const query = next.includes("?") ? next.slice(next.indexOf("?")) : "";
    const dest = `${path}${query}`;
    if (dest === "/") return "/login";
    return `/login?next=${encodeURIComponent(dest)}`;
}
