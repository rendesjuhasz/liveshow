"use client";

import { useEffect, useRef, useState } from "react";
import { playStreamerAlert } from "@/lib/streamer-alert-tone";
import { isSupportSoundOn } from "@/lib/streamer-support-sound";

export type SupportNotice = { author: string; tickets: number; ts: number };

export default function StreamerSupportToast({ notice }: { notice: SupportNotice | null }) {
    const queue = useRef<SupportNotice[]>([]);
    const [current, setCurrent] = useState<SupportNotice | null>(null);
    const lastKey = useRef("");

    useEffect(() => {
        if (!notice) return;
        const key = `${notice.ts}:${notice.author}:${notice.tickets}`;
        if (key === lastKey.current) return;
        lastKey.current = key;
        queue.current.push({
            author: String(notice.author || "").trim() || "Néző",
            tickets: Math.max(1, Math.floor(Number(notice.tickets) || 1)),
            ts: notice.ts,
        });
        setCurrent((shown) => shown || queue.current.shift() || null);
    }, [notice]);

    useEffect(() => {
        if (!current) return;
        if (isSupportSoundOn()) playStreamerAlert("support");
        const timer = window.setTimeout(() => {
            setCurrent(queue.current.shift() || null);
        }, 4500);
        return () => window.clearTimeout(timer);
    }, [current]);

    if (!current) return null;

    return (
        <p
            role="status"
            className="pointer-events-none absolute right-3 top-[calc(7.75rem+env(safe-area-inset-top))] z-40 w-[min(16rem,46vw)] rounded-2xl border border-amber-300/40 bg-[#2f2f2f] px-3 py-2.5 text-right text-sm font-semibold leading-snug text-white shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
        >
            {current.author} {current.tickets} jeggyel támogatott.
        </p>
    );
}
