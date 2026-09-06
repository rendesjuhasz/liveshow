"use client";

import { isAdmin, isStreamer, useAuth } from "@/context/AuthContext";

export function useStreamerGate() {
    const { user, ready } = useAuth();
    if (!ready) return { ok: false, wait: true, user: null };
    if (!user) return { ok: false, wait: false, user: null };
    if (!isStreamer(user) && !isAdmin(user)) return { ok: false, wait: false, user };
    return { ok: true, wait: false, user };
}
