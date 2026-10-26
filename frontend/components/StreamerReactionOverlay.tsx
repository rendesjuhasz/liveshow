"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { REACTION_STATS_ORDER, streamerReactionOrigin, type ReactionCounts } from "@/lib/live-reactions";
import { useMounted } from "@/lib/use-mounted";

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
    const mounted = useMounted();
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
        const box = host.getBoundingClientRect();
        const { right: fromRight, bottom: fromBottom } = streamerReactionOrigin(box.width, box.height);
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
            node.setAttribute("data-streamer-emoji", "1");
            node.style.position = "absolute";
            node.style.left = "auto";
            node.style.top = "auto";
            node.style.right = `${fromRight + Math.round(Math.random() * 28)}px`;
            node.style.bottom = `${fromBottom + Math.round(Math.random() * 40)}px`;
            node.style.pointerEvents = "none";
            node.style.userSelect = "none";
            node.style.willChange = "transform, opacity";
            node.style.lineHeight = "1";
            node.style.zIndex = "2";
            node.style.fontSize = item.burst ? "60px" : "34px";
            host.appendChild(node);
            const dx = -(16 + Math.round(Math.random() * 36));
            const dy = item.burst ? -72 : -(200 + Math.round(Math.random() * 120));
            const duration = item.burst ? 1000 : 3000 + Math.round(Math.random() * 1000);
            const from = "translate3d(0, 0, 0) scale(0.9)";
            const to = `translate3d(${dx}px, ${dy}px, 0) scale(${item.burst ? 1.1 : 1.15})`;
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
        if (mounted) pump();
    }, [mounted]);

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

    if (!mounted) return null;

    return createPortal(
        <div
            ref={hostRef}
            data-streamer-reaction-float
            className="pointer-events-none"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 260,
                overflow: "hidden",
            }}
        />,
        document.body,
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
