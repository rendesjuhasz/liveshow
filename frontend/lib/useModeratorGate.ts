"use client";

import { isModerator, useAuth } from "@/context/AuthContext";

export function useModeratorGate() {
    const { user, ready } = useAuth();
    if (!ready) return { ok: false, wait: true, user: null };
    if (!user || !isModerator(user)) return { ok: false, wait: false, user: user };
    return { ok: true, wait: false, user };
}
