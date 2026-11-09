"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isUsernamePath, needsUsername } from "@/lib/username";
import { stripLocalePrefix } from "@/lib/i18n/paths";

export default function UsernameGate() {
    const { user, ready, status } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!ready || status !== "authenticated" || !needsUsername(user)) return;
        const { path } = stripLocalePrefix(pathname || "/");
        if (isUsernamePath(path)) return;
        if (
            path === "/login" ||
            path === "/register" ||
            path === "/streamer-login" ||
            path === "/streamer-register" ||
            path === "/admin/login" ||
            path === "/logout" ||
            path.startsWith("/verify-email") ||
            path.startsWith("/forgot-password") ||
            path.startsWith("/reset-password") ||
            path.startsWith("/cookie-tajekoztato") ||
            path.startsWith("/adatkezeles") ||
            path.startsWith("/aszf")
        ) {
            return;
        }
        router.replace("/username");
    }, [ready, status, user, pathname, router]);

    return null;
}
