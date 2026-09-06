"use client";

import { isAdmin, useAuth } from "@/context/AuthContext";

export function useAdminGate() {
    const { user, ready } = useAuth();
    if (!ready) return { ok: false, wait: true };
    if (!user || !isAdmin(user)) return { ok: false, wait: false };
    return { ok: true, wait: false };
}
