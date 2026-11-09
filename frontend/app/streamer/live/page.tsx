"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import StreamerLiveStudio from "@/components/StreamerLiveStudio";
import StreamerPreflight from "@/components/StreamerPreflight";
import { fetchPreflightLast, type PreflightLast } from "@/lib/preflight";
import { clockClass, type PreflightGrade } from "@/lib/live-link-quality";
import {
    phoneHttpsLiveUrl,
    startStreamerMedia,
    stopStreamerMedia,
} from "@/components/StreamerLiveCamera";
import { StreamerGateNotice, useStreamerGate } from "@/lib/useStreamerGate";
import { canGoLiveOnShow } from "@/lib/media";

type LiveShowOption = {
    id: string;
    title: string;
    live?: boolean;
    streamId?: string;
    status?: string;
    scheduleStatus?: string;
    wentLiveAt?: string | null;
    startTime?: string | null;
    endTime?: string | null;
};

export default function StreamerLivePage() {
    const gate = useStreamerGate();
    const [shows, setShows] = useState<LiveShowOption[]>([]);
    const [showId, setShowId] = useState("");
    const [streamId, setStreamId] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [needsHttps, setNeedsHttps] = useState("");
    const [liveStartedAt, setLiveStartedAt] = useState(0);
    const [preflight, setPreflight] = useState<PreflightLast | null>(null);
    const [lastGrade, setLastGrade] = useState<PreflightGrade | null>(null);
    const cameraRef = useRef<MediaStream | null>(null);
    const startingRef = useRef(false);

    useEffect(() => {
        if (!gate.ok) return;
        fetchPreflightLast()
            .then((row) => {
                setPreflight(row);
                if (row.lastPreflightGrade) setLastGrade(row.lastPreflightGrade);
            })
            .catch(() => undefined);
        apiFetch("/streamer/shows")
            .then((d) => {
                const rows = (Array.isArray(d) ? d : []).filter((s: LiveShowOption) =>
                    canGoLiveOnShow({
                        live: s.live,
                        status: s.status,
                        startTime: s.startTime,
                        startAtUtc: s.startTime,
                        endAtUtc: s.endTime,
                        scheduleStatus: s.scheduleStatus,
                        wentLiveAt: s.wentLiveAt,
                    }),
                );
                setShows(rows);
                const wanted = new URLSearchParams(window.location.search).get("show");
                const preferred =
                    (wanted && rows.some((s) => s.id === wanted) ? wanted : "") ||
                    rows.find((s) => s.live)?.id ||
                    rows[0]?.id ||
                    "";
                setShowId(preferred);
                const found = rows.find((s) => s.id === preferred);
                if (found?.streamId) setStreamId(found.streamId);
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Nem sikerült betölteni a műsorokat."));
    }, [gate.ok]);

    useEffect(() => {
        const found = shows.find((s) => s.id === showId);
        if (found?.streamId) setStreamId(found.streamId);
    }, [showId, shows]);

    useEffect(() => {
        if (typeof window !== "undefined" && !window.isSecureContext) {
            setNeedsHttps(phoneHttpsLiveUrl());
        }
        return () => stopStreamerMedia(cameraRef.current);
    }, []);

    const selected = shows.find((s) => s.id === showId);

    async function setLive(live: boolean) {
        if (!showId || startingRef.current) return;
        startingRef.current = true;
        setError("");
        setMessage("");
        const sid = (streamId || selected?.streamId || "").trim();
        let nextStream: MediaStream | null = cameraStream;
        try {
            setBusy(true);
            if (live) {
                nextStream = await startStreamerMedia();
                cameraRef.current = nextStream;
                setCameraStream(nextStream);
                setLiveStartedAt(Date.now());
            } else {
                stopStreamerMedia(cameraRef.current);
                cameraRef.current = null;
                setCameraStream(null);
                setLiveStartedAt(0);
            }
            const data = await apiFetch(`/streamer/shows/${showId}/live`, {
                method: "POST",
                body: JSON.stringify({
                    live,
                    streamId: sid,
                }),
            });
            setShows((prev) =>
                prev.map((s) => (s.id === showId ? { ...s, ...(data?.show || {}), live } : s)),
            );
            if (!live) {
                setMessage("Az élő adás leállt.");
            }
        } catch (err: unknown) {
            if (live) {
                stopStreamerMedia(nextStream);
                cameraRef.current = null;
                setCameraStream(null);
                setLiveStartedAt(0);
            }
            setError(err instanceof Error ? err.message : "Nem sikerült frissíteni az élő állapotot.");
        } finally {
            setBusy(false);
            startingRef.current = false;
        }
    }

    if (!gate.ok) return <StreamerGateNotice reason={gate.reason} />;

    if (cameraStream && showId) {
        return (
            <StreamerLiveStudio
                showId={showId}
                stream={cameraStream}
                startedAt={liveStartedAt || Date.now()}
                busy={busy}
                onStop={() => void setLive(false)}
            />
        );
    }

    return (
        <StreamerShell title="Élő adás">
            {shows.length === 0 ? (
                <p className="text-neutral-400">
                    Nincs meghirdetett, még le nem játszott műsor. Az archív és a már lefutott
                    adások ide nem kerülnek.{" "}
                    <Link href="/streamer/shows/new" className="text-accent underline">
                        Új műsor
                    </Link>
                </p>
            ) : (
                <form
                    className="relative mx-auto grid max-w-md gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void setLive(true);
                    }}
                >
                    {needsHttps ? (
                        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-200">
                            Ezen a címen a böngésző nem engedélyezi a kamerát. Telefonon a HTTPS
                            Cloudflare-címet nyisd (…trycloudflare.com/streamer/live).
                        </p>
                    ) : (
                        <p className="text-sm text-neutral-400">
                            Először futtasd az adás előtti ellenőrzést, aztán a zöld gombbal indíts.
                            Chrome vagy Safari kell, ne Facebook/Instagram ablak.
                            Ha új trycloudflare címet kaptál, előbb itt lépj be újra:{" "}
                            <Link href="/streamer-login" className="text-accent underline">
                                Tartalomkészítő belépés
                            </Link>
                            .
                        </p>
                    )}
                    <StreamerPreflight
                        onLiveReady={(grade) => {
                            setLastGrade(grade);
                            setPreflight({
                                lastPreflightAt: new Date().toISOString(),
                                lastPreflightGrade: grade,
                                stale: false,
                                ageMs: 0,
                            });
                        }}
                    />
                    {preflight?.stale ? (
                        <p className={`text-sm ${clockClass("fair")}`}>
                            ⚠️ A hálózati állapot azóta megváltozhatott. Új teszt ajánlott.
                        </p>
                    ) : null}
                    {lastGrade === "critical" ? (
                        <p className={`text-sm ${clockClass("critical")}`}>
                            Kritikus teszt: az élő indítás nem ajánlott.
                        </p>
                    ) : null}
                    <label className="grid gap-1 text-sm">
                        Műsor
                        <select
                            className="min-h-12 rounded-xl p-3 text-base text-black"
                            value={showId}
                            onChange={(e) => setShowId(e.target.value)}
                            disabled={busy}
                        >
                            {shows.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.title}
                                    {s.live ? " (élő — kamera kell)" : ""}
                                </option>
                            ))}
                        </select>
                    </label>
                    {selected?.live && !cameraStream ? (
                        <p className="rounded-xl bg-emerald-950/60 p-3 text-sm text-emerald-200">
                            A műsor élőnek van jelölve, de a telefon kamerája nincs csatlakozva.
                            Nyomd a gombot, engedélyezd a kamerát, és hagyd nyitva ezt a fület.
                            A nézői gép legyen ugyanazon a Wi‑Fin, Élő menü.
                        </p>
                    ) : null}
                    {!streamId ? (
                        <label className="grid gap-1 text-sm">
                            Stream ID
                            <input
                                className="min-h-12 rounded-xl p-3 text-base text-black"
                                value={streamId}
                                onChange={(e) => setStreamId(e.target.value)}
                                disabled={busy}
                            />
                        </label>
                    ) : null}
                    {error && (
                        <p className="rounded-xl bg-red-950/70 p-3 text-sm text-red-300" role="alert">
                            {error}
                        </p>
                    )}
                    {message && <p className="text-green-400">{message}</p>}
                    <div className="sticky bottom-0 -mx-1 bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        <button
                            type="submit"
                            disabled={busy || Boolean(needsHttps) || !showId}
                            className={`min-h-14 w-full rounded-2xl text-lg font-bold disabled:opacity-50 ${
                                lastGrade === "critical" ? "bg-red-700" : "bg-green-600"
                            }`}
                        >
                            {busy
                                ? "Indítás..."
                                : selected?.live
                                  ? "Kamera újraindítása"
                                  : lastGrade === "critical"
                                    ? "Mégis indítom"
                                    : "✅ Élő adás indítása"}
                        </button>
                    </div>
                </form>
            )}
        </StreamerShell>
    );
}
