"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "@/api/http";
import { detectBrowserTimeZone } from "@/lib/timezone";
import { useAuth } from "@/context/AuthContext";

export default function TimezoneSync() {
    const { user } = useAuth();
    const sent = useRef("");

    useEffect(() => {
        if (!user) return;
        const tz = detectBrowserTimeZone();
        if (!tz || sent.current === tz) return;
        if (user.timezone === tz) {
            sent.current = tz;
            return;
        }
        sent.current = tz;
        apiFetch("/auth/profile", {
            method: "PATCH",
            body: JSON.stringify({ timezone: tz }),
        }).catch(() => undefined);
    }, [user?.id, user?.timezone]);

    return null;
}
