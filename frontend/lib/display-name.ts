export function displayName(user: {
    username?: string | null;
    name?: string | null;
    email?: string | null;
    streamer?: { name?: string | null; username?: string | null } | null;
} | null) {
    const handle = String(user?.username || user?.streamer?.username || "").trim();
    if (handle) return handle;
    return "Felhasználó";
}

export function displayInitial(user: {
    username?: string | null;
    name?: string | null;
    email?: string | null;
    streamer?: { name?: string | null; username?: string | null } | null;
} | null) {
    const value = displayName(user);
    return value ? value.charAt(0).toUpperCase() : "?";
}
