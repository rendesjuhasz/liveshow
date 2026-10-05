"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/api/http";
import { connectLiveSocket } from "@/lib/live-socket";
import type { StreamAlert } from "@/lib/stream-alert";

const SEVERITY: Record<string, string> = {
    info: "border-sky-400 bg-sky-950/90",
    warning: "border-yellow-400 bg-yellow-950/90",
    critical: "border-red-500 bg-red-950/90",
};

function isActive(a: StreamAlert) {
    if (a.resolvedAt) return false;
    if (a.snoozedUntil && new Date(a.snoozedUntil).getTime() > Date.now()) return false;
    return a.active !== false;
}

export default function SafetyAlertsPanel({ showId }: { showId: string }) {
    const [alerts, setAlerts] = useState<StreamAlert[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);
    const [pushOk, setPushOk] = useState(false);

    const load = useCallback(async () => {
        if (!showId) return;
        const data = await apiFetch(`/alerts?showId=${encodeURIComponent(showId)}&status=active`);
        setAlerts(Array.isArray(data?.alerts) ? data.alerts : []);
    }, [showId]);

    useEffect(() => {
        load().catch(() => undefined);
        const poll = setInterval(() => load().catch(() => undefined), 30_000);
        return () => clearInterval(poll);
    }, [load]);

    useEffect(() => {
        if (!showId) return;
        let socket: { disconnect: () => void; on: Function; emit: Function } | null = null;
        let cancelled = false;
        void connectLiveSocket(true)
            .then((sock) => {
                if (cancelled) {
                    sock.disconnect();
                    return;
                }
                socket = sock;
                const join = () => sock.emit("alerts:join", { showId });
                sock.on("connect", join);
                if (sock.connected) join();
                sock.on("safety-alert", (payload: { action?: string; alert?: StreamAlert }) => {
                    if (payload?.action === "deleted" && payload.alert?.id) {
                        setAlerts((prev) => prev.filter((a) => a.id !== payload.alert!.id));
                        return;
                    }
                    if (payload?.alert) {
                        setAlerts((prev) => {
                            const rest = prev.filter((a) => a.id !== payload.alert!.id);
                            return [payload.alert!, ...rest].slice(0, 20);
                        });
                        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                            new Notification(payload.alert.title, { body: payload.alert.recommendation });
                        }
                    }
                });
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
            socket?.emit("alerts:leave", { showId });
            socket?.disconnect();
        };
    }, [showId]);

    const visible = useMemo(() => alerts.filter(isActive).slice(0, 3), [alerts]);

    async function act(id: string, path: "dismiss" | "snooze") {
        await apiFetch(`/alerts/${id}/${path}`, {
            method: "POST",
            body: path === "snooze" ? JSON.stringify({ minutes: 5 }) : "{}",
        });
        await load();
    }

    if (!showId || visible.length === 0) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:right-6 md:w-[min(100%,24rem)]">
            <div className="pointer-events-auto flex flex-col gap-3">
                {visible.map((a) => (
                    <article
                        key={a.id}
                        className={`rounded-2xl border-2 p-4 shadow-lg ${SEVERITY[a.severity] || SEVERITY.warning}`}
                    >
                        <p className="text-base font-bold leading-snug md:text-lg">{a.title}</p>
                        <p className="mt-1 text-xs text-white/70">{new Date(a.createdAt).toLocaleString("hu-HU")}</p>
                        <p className="mt-2 text-sm leading-relaxed text-white/90">
                            <span className="font-semibold">Ajánlás: </span>
                            {a.recommendation}
                        </p>
                        {openId === a.id && <p className="mt-2 text-sm text-white/80">{a.message}</p>}
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                className="min-h-11 rounded-xl bg-white/15 text-sm font-semibold"
                                onClick={() => act(a.id, "dismiss")}
                            >
                                Eltüntetés
                            </button>
                            <button
                                type="button"
                                className="min-h-11 rounded-xl bg-white/15 text-sm font-semibold"
                                onClick={() => act(a.id, "snooze")}
                            >
                                5 perc
                            </button>
                            <button
                                type="button"
                                className="min-h-11 rounded-xl bg-white/15 text-sm font-semibold"
                                onClick={() => setOpenId(openId === a.id ? null : a.id)}
                            >
                                Részletek
                            </button>
                        </div>
                    </article>
                ))}
                {!pushOk && typeof Notification !== "undefined" && Notification.permission === "default" && (
                    <button
                        type="button"
                        className="rounded-xl bg-neutral-800 px-3 py-2 text-left text-xs text-neutral-300"
                        onClick={() => Notification.requestPermission().then((p) => setPushOk(p === "granted"))}
                    >
                        Böngésző push engedélyezése
                    </button>
                )}
            </div>
        </div>
    );
}
