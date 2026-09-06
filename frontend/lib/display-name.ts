export function displayName(user: {
    name?: string | null;
    email?: string | null;
    streamer?: { name?: string | null } | null;
} | null) {
    const named = String(user?.name || user?.streamer?.name || "").trim();
    if (named) return named;
    return "Felhasználó";
}

export function displayInitial(user: {
    name?: string | null;
    email?: string | null;
    streamer?: { name?: string | null } | null;
} | null) {
    const value = displayName(user);
    return value ? value.charAt(0).toUpperCase() : "?";
}
