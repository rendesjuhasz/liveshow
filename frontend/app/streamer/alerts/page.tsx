"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import type { StreamAlert } from "@/lib/stream-alert";

export default function StreamerAlertsPage() {
    const gate = useStreamerGate();
    const [shows, setShows] = useState<any[]>([]);
    const [showId, setShowId] = useState("");
    const [status, setStatus] = useState("");
    const [severity, setSeverity] = useState("");
    const [alerts, setAlerts] = useState<StreamAlert[]>([]);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState("");
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(true);
    const [discordWebhook, setDiscordWebhook] = useState("");
    const [telegramChatId, setTelegramChatId] = useState("");

    const loadAlerts = useCallback(() => {
        const q = new URLSearchParams();
        if (showId) q.set("showId", showId);
        if (status) q.set("status", status);
        if (severity) q.set("severity", severity);
        return apiFetch(`/alerts/history?${q.toString()}`).then((d) =>
            setAlerts(Array.isArray(d?.alerts) ? d.alerts : []),
        );
    }, [showId, status, severity]);

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/streamer/shows")
            .then((d) => {
                const rows = Array.isArray(d) ? d : [];
                setShows(rows);
                setShowId((id) => id || rows[0]?.id || "");
            })
            .catch((err: any) => setError(err.message || "Hiba"));
        apiFetch("/alerts/settings")
            .then((d) => {
                setEmailEnabled(Boolean(d?.emailEnabled));
                setPushEnabled(d?.pushEnabled !== false);
                setDiscordWebhook(d?.discordWebhook || "");
                setTelegramChatId(d?.telegramChatId || "");
            })
            .catch(() => undefined);
    }, [gate.ok]);

    useEffect(() => {
        if (!gate.ok) return;
        loadAlerts().catch((err: any) => setError(err.message || "Nem sikerült betölteni."));
    }, [gate.ok, loadAlerts]);

    const resolvedCount = alerts.filter((a) => a.resolvedAt).length;

    async function markSeen(id: string) {
        setError("");
        setBusyId(id);
        try {
            await apiFetch(`/alerts/${id}/dismiss`, { method: "POST", body: "{}" });
            await loadAlerts();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Nem sikerült megjelölni.");
        } finally {
            setBusyId("");
        }
    }

    async function removeOne(id: string) {
        setError("");
        setBusyId(id);
        try {
            await apiFetch(`/alerts/${id}`, { method: "DELETE" });
            setAlerts((prev) => prev.filter((a) => a.id !== id));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "A törlés nem sikerült.");
        } finally {
            setBusyId("");
        }
    }

    async function removeResolved() {
        setError("");
        setBusyId("resolved");
        try {
            const q = showId ? `?showId=${encodeURIComponent(showId)}` : "";
            await apiFetch(`/alerts/resolved${q}`, { method: "DELETE" });
            await loadAlerts();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "A törlés nem sikerült.");
        } finally {
            setBusyId("");
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A tartalomkészítő felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title="AI Safety Alerts">
            <p className="mb-4 max-w-2xl text-sm text-neutral-400">
                Élő adás közben a rendszer bitrate, FPS, HLS, ingest, nézőszám, chat, jegyek és szerver
                terhelés alapján riaszt. A megtekintett, lezárt riasztásokat törölheted.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <select className="rounded bg-neutral-800 p-2" value={showId} onChange={(e) => setShowId(e.target.value)}>
                    <option value="">Minden műsor</option>
                    {shows.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.title}
                        </option>
                    ))}
                </select>
                <select className="rounded bg-neutral-800 p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">Aktív</option>
                    <option value="resolved">Lezárt</option>
                    <option value="">Mind</option>
                </select>
                <select className="rounded bg-neutral-800 p-2" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                    <option value="">Minden szint</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                    <option value="info">Info</option>
                </select>
                {resolvedCount > 0 && (
                    <button
                        type="button"
                        className="rounded-xl bg-neutral-800 px-3 py-2 text-sm font-semibold text-red-300 disabled:opacity-50"
                        disabled={Boolean(busyId)}
                        onClick={() => void removeResolved()}
                    >
                        {busyId === "resolved" ? "Törlés..." : "Lezártak törlése"}
                    </button>
                )}
            </div>
            {error && <p className="mb-3 text-red-400">{error}</p>}
            <ul className="mb-8 space-y-3">
                {alerts.length === 0 && <li className="text-neutral-500">Nincs riasztás a szűrőkre.</li>}
                {alerts.map((a) => (
                    <li key={a.id} className="rounded-2xl bg-neutral-900 p-4">
                        <p className="font-semibold">
                            <span
                                className={
                                    a.severity === "critical"
                                        ? "text-red-400"
                                        : a.severity === "info"
                                          ? "text-sky-400"
                                          : "text-yellow-400"
                                }
                            >
                                {a.severity.toUpperCase()}
                            </span>{" "}
                            {a.title}
                        </p>
                        <p className="mt-1 text-sm text-neutral-300">{a.message}</p>
                        <p className="mt-1 text-sm text-neutral-400">Ajánlás: {a.recommendation}</p>
                        {(a.severity === "warning" || a.severity === "critical") && (
                            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                                <p className="text-sm text-neutral-300">Nem találod a megoldást?</p>
                                <Link
                                    href="/streamer/help/contact"
                                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-yellow-400 hover:underline"
                                >
                                    📩 Hibabejelentés küldése
                                </Link>
                            </div>
                        )}
                        <p className="mt-2 text-xs text-neutral-500">
                            {new Date(a.createdAt).toLocaleString("hu-HU")}
                            {a.resolvedAt ? " · lezárva" : ""}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {!a.resolvedAt && (
                                <button
                                    type="button"
                                    className="rounded-xl bg-neutral-800 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                                    disabled={Boolean(busyId)}
                                    onClick={() => void markSeen(a.id)}
                                >
                                    {busyId === a.id ? "..." : "Megnéztem"}
                                </button>
                            )}
                            {a.resolvedAt && (
                                <button
                                    type="button"
                                    className="rounded-xl bg-neutral-800 px-3 py-2 text-sm font-semibold text-red-300 disabled:opacity-50"
                                    disabled={Boolean(busyId)}
                                    onClick={() => void removeOne(a.id)}
                                >
                                    {busyId === a.id ? "Törlés..." : "Törlés"}
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            <form
                className="max-w-xl space-y-3 rounded-2xl bg-neutral-900 p-4"
                onSubmit={async (e) => {
                    e.preventDefault();
                    await apiFetch("/alerts/settings", {
                        method: "PUT",
                        body: JSON.stringify({ emailEnabled, pushEnabled, discordWebhook, telegramChatId }),
                    });
                }}
            >
                <h2 className="font-semibold">Értesítések</h2>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
                    Email (tartalomkészítő kapcsolat)
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={pushEnabled} onChange={(e) => setPushEnabled(e.target.checked)} />
                    Böngésző push (élő panel)
                </label>
                <label className="grid gap-1 text-sm">
                    Discord webhook
                    <input className="rounded p-2 text-black" value={discordWebhook} onChange={(e) => setDiscordWebhook(e.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">
                    Telegram chat id
                    <input className="rounded p-2 text-black" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} />
                </label>
                <p className="text-xs text-neutral-500">Telegram bothoz: ALERT_TELEGRAM_BOT_TOKEN a szerver .env-ben.</p>
                <button className="rounded-xl bg-yellow-500 px-4 py-2 font-bold text-black">Mentés</button>
            </form>
        </StreamerShell>
    );
}
