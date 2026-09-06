export const USER_ROLES = {
    USER: "user",
    ADMIN: "admin",
    MODERATOR: "moderator",
    STREAMER: "streamer",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const BOOTSTRAP_ADMIN_EMAIL = "admin@admin.com";

export function bootstrapAdminEmail() {
    return String(process.env.BOOTSTRAP_ADMIN_EMAIL || BOOTSTRAP_ADMIN_EMAIL)
        .trim()
        .toLowerCase();
}

export function normalizeRole(role?: string | null): UserRole {
    const value = String(role || "").trim().toLowerCase();
    if (value === USER_ROLES.ADMIN) return USER_ROLES.ADMIN;
    if (value === USER_ROLES.MODERATOR) return USER_ROLES.MODERATOR;
    if (value === USER_ROLES.STREAMER) return USER_ROLES.STREAMER;
    return USER_ROLES.USER;
}

export function isAdminRole(user?: { role?: string | null; email?: string | null } | null) {
    if (!user) return false;
    const email = String(user.email || "").trim().toLowerCase();
    return (
        normalizeRole(user.role) === USER_ROLES.ADMIN ||
        email === bootstrapAdminEmail()
    );
}

export function isModeratorRole(user?: { role?: string | null; email?: string | null } | null) {
    if (!user) return false;
    return isAdminRole(user) || normalizeRole(user.role) === USER_ROLES.MODERATOR;
}

export function isStreamerRole(user?: { role?: string | null; email?: string | null } | null) {
    if (!user) return false;
    return isAdminRole(user) || normalizeRole(user.role) === USER_ROLES.STREAMER;
}

export function roleForEmail(email: string): UserRole {
    return isAdminRole({ email, role: USER_ROLES.USER })
        ? USER_ROLES.ADMIN
        : USER_ROLES.USER;
}
