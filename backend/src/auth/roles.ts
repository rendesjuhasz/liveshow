export const USER_ROLES = {
    USER: "user",
    ADMIN: "admin",
    MODERATOR: "moderator",
    STREAMER: "streamer",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const BLOCKED_BOOTSTRAP_ADMIN = "admin@admin.com";

/** Optional mailbox for CLI seed / contact fallback. Never grants admin by itself. */
export function bootstrapAdminEmail() {
    const value = String(process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
    if (process.env.NODE_ENV === "production" && value === BLOCKED_BOOTSTRAP_ADMIN) {
        throw new Error("Élesben a BOOTSTRAP_ADMIN_EMAIL nem lehet admin@admin.com.");
    }
    return value;
}

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
