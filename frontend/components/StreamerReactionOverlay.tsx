"use client";

import { useEffect, useRef } from "react";
import { REACTION_STATS_ORDER, type ReactionCounts } from "@/lib/live-reactions";

type Floater = {
    id: number;
    value: string;
    burst?: boolean;
};

const MAX_ON_SCREEN = 15;
const MAX_SPAWN_PER_100MS = 5;

export function StreamerReactionFloat({
    event,
    session,
}: {
    event: { value: string; ts: number } | null;
    session: number;
}) {
    const hostRef = useRef<HTMLDivElement>(null);
    const queue = useRef<Floater[]>([]);
    const onScreen = useRef(0);
    const recent = useRef<Record<string, number[]>>({});
    const lastBurst = useRef<Record<string, number>>({});
    const spawnTimes = useRef<number[]>([]);
    const uid = useRef(1);

    function clearAll() {
        queue.current = [];
        onScreen.current = 0;
        recent.current = {};
        lastBurst.current = {};
        spawnTimes.current = [];
        const host = hostRef.current;
        if (host) host.replaceChildren();
    }

    function pump() {
        const host = hostRef.current;
        if (!host) return;
        const now = Date.now();
        spawnTimes.current = spawnTimes.current.filter((t) => now - t < 100);
        while (
            onScreen.current < MAX_ON_SCREEN &&
            queue.current.length &&
            spawnTimes.current.length < MAX_SPAWN_PER_100MS
        ) {
            const item = queue.current.shift();
            if (!item) break;
            onScreen.current += 1;
            spawnTimes.current.push(now);
            const node = document.createElement("span");
            node.textContent = item.value;
            node.setAttribute("aria-hidden", "true");
            node.style.position = "absolute";
            node.style.left = "100%";
            node.style.top = "100%";
            node.style.pointerEvents = "none";
            node.style.userSelect = "none";
            node.style.willChange = "transform, opacity";
            node.style.lineHeight = "1";
            node.style.fontSize = item.burst ? "60px" : "";
            if (!item.burst) node.className = "text-[28px] md:text-[32px] lg:text-[36px]";
            host.appendChild(node);
            const startRight = 16 + Math.round(Math.random() * 24);
            const startBottom = 16 + Math.round(Math.random() * 16);
            const dx = Math.round(Math.random() * 80 - 40);
            const dy = item.burst ? -72 : -(250 + Math.round(Math.random() * 150));
            const duration = item.burst ? 1000 : 3000 + Math.round(Math.random() * 1000);
            const from = `translate3d(${-startRight}px, ${-startBottom}px, 0) scale(0.9)`;
            const to = `translate3d(${-startRight + dx}px, ${-startBottom + dy}px, 0) scale(${item.burst ? 1.1 : 1.15})`;
            const anim = node.animate(
                [
                    { opacity: 1, transform: from },
                    { opacity: 0, transform: to },
                ],
                { duration, easing: "linear", fill: "forwards" },
            );
            anim.onfinish = () => {
                node.remove();
                onScreen.current = Math.max(0, onScreen.current - 1);
                pump();
            };
        }
    }

    useEffect(() => {
        clearAll();
    }, [session]);

    useEffect(() => {
        const value = String(event?.value || "").trim();
        if (!value || !event?.ts) return;
        const now = event.ts;
        const times = (recent.current[value] || []).filter((t) => now - t < 5000);
        times.push(now);
        recent.current[value] = times;
        queue.current.push({ id: uid.current++, value });
        const burstOk = now - (lastBurst.current[value] || 0) >= 10_000;
        if (times.length >= 10 && burstOk) {
            lastBurst.current[value] = now;
            queue.current.push({ id: uid.current++, value, burst: true });
        }
        if (queue.current.length > 40) queue.current.splice(0, queue.current.length - 40);
        pump();
    }, [event]);

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            <div
                ref={hostRef}
                className="pointer-events-none absolute bottom-36 right-0 top-14 w-28 overflow-hidden md:bottom-40"
            />
        </div>
    );
}

export function StreamerReactionStats({ counts }: { counts: ReactionCounts }) {
    const rows = REACTION_STATS_ORDER.filter((row) => (counts[row.key] || 0) > 0);
    if (!rows.length) {
        return <p className="mb-2 text-center text-[11px] text-white/40">Még nincs nézői reakció</p>;
    }
    return (
        <div
            className="mb-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-white/90"
            aria-label="Reakció statisztika"
        >
            {rows.map((row) => (
                <span key={row.key} className="tabular-nums drop-shadow">
                    {row.emoji} {counts[row.key]}
                </span>
            ))}
        </div>
    );
}
