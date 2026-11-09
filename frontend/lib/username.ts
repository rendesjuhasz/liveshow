export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(raw?: string | null) {
    return String(raw || "")
        .trim()
        .toLowerCase();
}

export function needsUsername(user: { username?: string | null } | null | undefined) {
    return Boolean(user && !normalizeUsername(user.username));
}

export function isUsernamePath(pathname = "") {
    const path = pathname.replace(/^\/(en|de|it|es|fr)(?=\/|$)/, "") || "/";
    return path === "/username" || path.startsWith("/username/");
}
