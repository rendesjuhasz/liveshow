"use client";

import { useEffect, useState } from "react";
import { getEventCountdown } from "@/lib/event-countdown";
import type { MediaItem } from "@/lib/media";

export function useEventCountdown(item: MediaItem) {
    const [now, setNow] = useState<number | null>(null);
    const countdown = now == null ? null : getEventCountdown(item, now);
    const tickMs = countdown?.tickMs ?? 0;

    useEffect(() => {
        setNow(Date.now());
    }, [item.startTime, item.live, item.ended]);

    useEffect(() => {
        if (tickMs <= 0) return;
        const id = window.setInterval(() => setNow(Date.now()), tickMs);
        return () => window.clearInterval(id);
    }, [tickMs, item.startTime, item.live, item.ended]);

    return countdown;
}
