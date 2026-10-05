import { stripLocalePrefix } from "@/lib/i18n/paths";

export const USER_ROLES = {
    USER: "user",
    ADMIN: "admin",
    MODERATOR: "moderator",
    STREAMER: "streamer",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export function normalizeRole(role?: string | null): UserRole {
    const value = String(role || "").trim().toLowerCase();
    if (value === USER_ROLES.ADMIN) return USER_ROLES.ADMIN;
    if (value === USER_ROLES.MODERATOR) return USER_ROLES.MODERATOR;
    if (value === USER_ROLES.STREAMER) return USER_ROLES.STREAMER;
    return USER_ROLES.USER;
}

export function isAdminRole(user?: { role?: string | null; isAdmin?: boolean } | null) {
    if (!user) return false;
    if (user.isAdmin === true) return true;
    return normalizeRole(user.role) === USER_ROLES.ADMIN;
}

export function isModeratorRole(user?: { role?: string | null; isAdmin?: boolean } | null) {
    if (!user) return false;
    return isAdminRole(user) || normalizeRole(user.role) === USER_ROLES.MODERATOR;
}

export function isStreamerRole(user?: { role?: string | null; isAdmin?: boolean } | null) {
    if (!user) return false;
    return isAdminRole(user) || normalizeRole(user.role) === USER_ROLES.STREAMER;
}

export function isStreamerAppPath(pathname = "") {
    const { path } = stripLocalePrefix(pathname);
    return path === "/streamer" || path.startsWith("/streamer/");
}

export function isStreamerChromePath(pathname = "") {
    const { path } = stripLocalePrefix(pathname);
    return (
        isStreamerAppPath(path) ||
        path === "/streamer-login" ||
        path === "/streamer-register" ||
        path === "/streamer-terms"
    );
}

export function isAdminAppPath(pathname = "") {
    const { path } = stripLocalePrefix(pathname);
    return path === "/admin" || path.startsWith("/admin/");
}

export function isStudioChromePath(pathname = "") {
    return isAdminAppPath(pathname) || isStreamerChromePath(pathname);
}

export function appSurfaceKey(pathname = "") {
    const { path } = stripLocalePrefix(pathname);
    if (isAdminAppPath(path)) return "nav.surface.admin";
    if (isStreamerChromePath(path)) {
        return "nav.surface.streamer";
    }
    return "nav.surface.viewer";
}

export function appSurfaceLabel(pathname = "") {
    const key = appSurfaceKey(pathname);
    if (key === "nav.surface.admin") return "Admin";
    if (key === "nav.surface.streamer") return "Tartalomkészítő";
    return "Viewer";
}

/** Browser tab title so laptop windows stay distinguishable. */
export function appWindowTitle(pathname = "") {
    return `${appSurfaceLabel(pathname)} · LiveShow`;
}

export function sessionStatusLabel(
    user: { role?: string | null; isAdmin?: boolean } | null,
    pathname = "",
) {
    if (!user) return "";
    return appSurfaceLabel(pathname);
}
