"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Eye, FlipHorizontal, Maximize2, Mic, MicOff, Minus, Plus } from "lucide-react";
import { apiFetch, apiUpload } from "@/api/http";
import StreamerLiveCamera, {
    type StreamerLiveCameraHandle,
} from "@/components/StreamerLiveCamera";
import { clockClass, type LiveLinkQuality } from "@/lib/live-link-quality";
import { playStreamerAlert } from "@/lib/streamer-alert-tone";
import { createLiveWakeLock } from "@/lib/live-wake-lock";
import { emptyReactionCounts, mergeReactionCounts, type ReactionCounts } from "@/lib/live-reactions";
import { StreamerReactionFloat, StreamerReactionStats } from "@/components/StreamerReactionOverlay";
import StreamerHoldStop from "@/components/StreamerHoldStop";

type QuestionRow = { text?: string; topicKey?: string } | null;

function formatClock(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

const BTN =
    "flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl active:scale-95";

export default function StreamerLiveStudio({
    showId,
    stream,
    startedAt,
    busy,
    onStop,
}: {
    showId: string;
    stream: MediaStream;
    startedAt: number;
    busy: boolean;
    onStop: () => void;
}) {
    const studioRef = useRef<HTMLDivElement>(null);
    const camRef = useRef<StreamerLiveCameraHandle>(null);
    const pressTimer = useRef(0);
    const longPress = useRef(false);
    const hadQuestion = useRef(false);
    const shownQuestionKey = useRef("");
    const netAlerted = useRef(false);
    const micAlerted = useRef(false);
    const wakeLock = useRef(createLiveWakeLock());
    const lastAwayTone = useRef(0);

    const [clock, setClock] = useState("00:00:00");
    const [viewers, setViewers] = useState(0);
    const [quality, setQuality] = useState<LiveLinkQuality>("good");
    const [reconnecting, setReconnecting] = useState(false);
    const [micOn, setMicOn] = useState(true);
    const [micBroken, setMicBroken] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [expanded, setExpanded] = useState(false);
    const [landscape, setLandscape] = useState(false);
    const [question, setQuestion] = useState<QuestionRow>(null);
    const [overlayOn, setOverlayOn] = useState(false);
    const [recall, setRecall] = useState(false);
    const [emptyHint, setEmptyHint] = useState(false);
    const [qBusy, setQBusy] = useState(false);
    const [savingArchive, setSavingArchive] = useState(false);
    const [signError, setSignError] = useState("");
    const [reactionCounts, setReactionCounts] = useState<ReactionCounts>(emptyReactionCounts);
    const [reactionEvent, setReactionEvent] = useState<{ value: string; ts: number } | null>(null);
    const [confirmStop, setConfirmStop] = useState(false);
    const [leftPage, setLeftPage] = useState(false);
    const [cameraLive, setCameraLive] = useState(true);
    const [recovering, setRecovering] = useState(false);
    const [mediaMessage, setMediaMessage] = useState("");
    const [restoreBusy, setRestoreBusy] = useState("");

    useEffect(() => {
        const t = window.setInterval(() => setClock(formatClock(Date.now() - startedAt)), 250);
        return () => window.clearInterval(t);
    }, [startedAt]);

    useEffect(() => {
        let cancelled = false;
        async function tick() {
            try {
                const data = await apiFetch(`/views/live/${encodeURIComponent(showId)}`);
                if (!cancelled) setViewers(Number(data?.viewerCount) || 0);
            } catch {
                /* ignore */
            }
        }
        tick();
        const t = window.setInterval(tick, 15_000);
        return () => {
            cancelled = true;
            window.clearInterval(t);
        };
    }, [showId]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const data = await apiFetch(`/streamer/questions?showId=${encodeURIComponent(showId)}`);
                if (cancelled) return;
                const current = data?.current || null;
                const key = String(current?.topicKey || current?.text || "");
                const now = Boolean(key);
                if (now && shownQuestionKey.current !== key) {
                    shownQuestionKey.current = key;
                    playStreamerAlert("question");
                    setOverlayOn(true);
                }
                hadQuestion.current = now;
                setQuestion(current);
                if (!now) {
                    shownQuestionKey.current = "";
                    setOverlayOn(false);
                }
            } catch {
                /* ignore */
            }
        }
        load();
        const t = window.setInterval(load, 8000);
        return () => {
            cancelled = true;
            window.clearInterval(t);
        };
    }, [showId]);

    useEffect(() => {
        if (!overlayOn) return;
        const hide = window.setTimeout(() => setOverlayOn(false), 10_000);
        return () => window.clearTimeout(hide);
    }, [overlayOn, question?.topicKey, question?.text]);

    useEffect(() => {
        if (quality === "critical") {
            if (!netAlerted.current) {
                netAlerted.current = true;
                playStreamerAlert("net");
            }
            return;
        }
        netAlerted.current = false;
    }, [quality]);

    useEffect(() => {
        if (micBroken && micOn) {
            if (!micAlerted.current) {
                micAlerted.current = true;
                playStreamerAlert("mic");
            }
            return;
        }
        micAlerted.current = false;
    }, [micBroken, micOn]);

    useEffect(() => {
        void wakeLock.current.acquire();
        let armed = false;
        const tone = () => {
            const now = Date.now();
            if (now - lastAwayTone.current < 800) return;
            lastAwayTone.current = now;
            playStreamerAlert("background");
        };
        const onHidden = () => {
            tone();
            setLeftPage(true);
        };
        const onVisible = () => {
            void wakeLock.current.acquire();
            if (!armed) return;
            setLeftPage(true);
            tone();
            void camRef.current?.restoreStream().then((ok) => {
                if (ok) {
                    setCameraLive(true);
                    setRecovering(false);
                    setLeftPage(false);
                    setMediaMessage("");
                }
            });
        };
        const onVisibility = () => {
            if (document.visibilityState === "hidden") onHidden();
            else onVisible();
        };
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", onHidden);
        window.addEventListener("pageshow", onVisible);
        const arm = window.setTimeout(() => {
            armed = true;
        }, 400);
        return () => {
            window.clearTimeout(arm);
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pagehide", onHidden);
            window.removeEventListener("pageshow", onVisible);
            void wakeLock.current.release();
        };
    }, []);

    async function nextQuestion() {
        if (qBusy) return;
        setQBusy(true);
        setEmptyHint(false);
        try {
            const res = await apiFetch("/streamer/questions/next", {
                method: "POST",
                body: JSON.stringify({ showId }),
            });
            const next = res?.next ?? null;
            const nextKey = String(next?.topicKey || next?.text || "");
            setQuestion(next);
            hadQuestion.current = Boolean(nextKey);
            shownQuestionKey.current = nextKey;
            if (!next) setEmptyHint(true);
            setRecall(false);
            setOverlayOn(Boolean(nextKey));
        } catch {
            setEmptyHint(true);
        } finally {
            setQBusy(false);
        }
    }

    async function rejectQuestion() {
        if (qBusy) return;
        setQBusy(true);
        try {
            const res = await apiFetch("/streamer/questions/reject", {
                method: "POST",
                body: JSON.stringify({ showId }),
            });
            const next = res?.next ?? null;
            const nextKey = String(next?.topicKey || next?.text || "");
            setQuestion(next);
            hadQuestion.current = Boolean(nextKey);
            shownQuestionKey.current = nextKey;
            setRecall(false);
            setOverlayOn(Boolean(nextKey));
        } catch {
            /* ignore */
        } finally {
            setQBusy(false);
        }
    }

    useEffect(() => {
        const video = studioRef.current?.querySelector("video");
        if (!video) return;
        video.setAttribute("playsinline", "true");
        video.srcObject = stream;
        void video.play().catch(() => undefined);
    }, [expanded, stream, landscape]);

    useEffect(() => {
        const mq = window.matchMedia("(orientation: landscape) and (max-height: 560px)");
        const sync = () => setLandscape(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        const onOrient = () => {
            sync();
            window.setTimeout(() => {
                const video = studioRef.current?.querySelector("video");
                if (!video) return;
                video.srcObject = stream;
                void video.play().catch(() => undefined);
            }, 250);
        };
        window.addEventListener("orientationchange", onOrient);
        window.visualViewport?.addEventListener("resize", onOrient);
        return () => {
            mq.removeEventListener("change", sync);
            window.removeEventListener("orientationchange", onOrient);
            window.visualViewport?.removeEventListener("resize", onOrient);
        };
    }, [stream]);

    async function handleStop() {
        if (busy || savingArchive) return;
        setConfirmStop(false);
        setReactionCounts(emptyReactionCounts());
        setReactionEvent(null);
        setSavingArchive(true);
        try {
            const blob = await camRef.current?.stopRecording();
            if (blob && blob.size >= 4096) {
                const form = new FormData();
                const mp4 = blob.type.includes("mp4");
                const mime = (blob.type.split(";")[0] || (mp4 ? "video/mp4" : "video/webm")).trim();
                const file = new File([blob], mp4 ? "live.mp4" : "live.webm", { type: mime });
                form.append("video", file);
                await apiUpload(`/streamer/shows/${showId}/live-archive`, form);
            }
        } catch {
            /* a leállítás akkor is lefusson */
        }
        onStop();
    }

    async function runRestore(kind: "reconnect" | "camera" | "stream") {
        if (restoreBusy) return;
        setRestoreBusy(kind);
        setRecovering(true);
        try {
            if (kind === "camera") {
                const ok = await camRef.current?.restartCamera();
                if (ok) {
                    setCameraLive(true);
                    setMediaMessage("");
                    setLeftPage(false);
                }
                return;
            }
            const ok = await camRef.current?.restoreStream();
            if (kind === "stream" && !ok) {
                const camOk = await camRef.current?.restartCamera();
                if (camOk) {
                    setCameraLive(true);
                    setMediaMessage("");
                    setLeftPage(false);
                }
                return;
            }
            if (ok) {
                setCameraLive(true);
                setMediaMessage("");
                setLeftPage(false);
            }
        } finally {
            setRestoreBusy("");
            setRecovering(false);
        }
    }

    function toggleFullscreen() {
        setExpanded((on) => !on);
    }

    function onNextDown(ev: PointerEvent<HTMLButtonElement>) {
        ev.currentTarget.setPointerCapture(ev.pointerId);
        longPress.current = false;
        pressTimer.current = window.setTimeout(() => {
            longPress.current = true;
            setRecall(true);
        }, 520);
    }

    function onNextUp() {
        window.clearTimeout(pressTimer.current);
        if (longPress.current) return;
        void nextQuestion();
    }

    const netLabel =
        quality === "critical" ? (reconnecting ? "Újracsatlakozás..." : "Kapcsolat megszakadt") : "";
    const showCrisis = recovering || !cameraLive || leftPage || quality === "critical";

    return (
        <div
            ref={studioRef}
            className="fixed inset-0 z-50 bg-black text-white"
        >
            <div className="absolute inset-0 z-0">
                <StreamerLiveCamera
                    ref={camRef}
                    stream={stream}
                    showId={showId}
                    fill
                    zoomPreview={zoom}
                    onLink={(q, rec) => {
                        setQuality(q);
                        setReconnecting(rec);
                    }}
                    onAudioBroken={setMicBroken}
                    onSignalingError={setSignError}
                    onMediaHealth={(state) => {
                        setCameraLive(state.cameraLive);
                        setRecovering(state.recovering);
                        if (state.message) setMediaMessage(state.message);
                    }}
                    onReaction={(payload) => {
                        if (payload.counts) setReactionCounts(mergeReactionCounts(payload.counts));
                        const value = String(payload.value || payload.emoji || "").trim();
                        if (value) setReactionEvent({ value, ts: payload.ts });
                    }}
                    onReactionCounts={(counts) => setReactionCounts(mergeReactionCounts(counts))}
                />
            </div>
            <StreamerReactionFloat event={reactionEvent} session={startedAt} />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
                <div className="flex items-start justify-between">
                    <div>
                        <p className={`font-mono text-lg font-semibold tabular-nums drop-shadow ${clockClass(quality)}`}>
                            {clock}
                        </p>
                        {netLabel ? <p className="mt-1 text-sm font-semibold text-red-400 drop-shadow">{netLabel}</p> : null}
                        {signError ? <p className="mt-1 max-w-[14rem] text-xs font-semibold text-red-300 drop-shadow">{signError}</p> : null}
                    </div>
                    <p className="flex items-center gap-1 text-sm font-semibold text-white drop-shadow">
                        <Eye className="h-4 w-4 text-white/85" />
                        {viewers}
                    </p>
                </div>
                <p className="mt-2 rounded-lg border border-white/15 bg-amber-400/80 px-3 py-1.5 text-center text-xs font-semibold text-black shadow-[0_8px_20px_rgba(0,0,0,0.25)] backdrop-blur-md">
                    Ne hagyd el ezt az oldalt élő adás közben.
                </p>
            </div>
                {overlayOn && question?.text ? (
                    <div className="pointer-events-none absolute inset-x-4 top-1/3 z-20 rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-center text-lg font-semibold leading-snug shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                        ❓ {question.text}
                    </div>
                ) : null}
                {emptyHint && !question ? (
                    <p className="pointer-events-none absolute inset-x-4 bottom-36 z-20 text-center text-sm font-medium text-white/80">
                        Nincs kérdés
                    </p>
                ) : null}
                {savingArchive ? (
                    <p className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/55 text-center text-base font-semibold text-white backdrop-blur-sm">
                        Felvétel feltöltése…
                    </p>
                ) : null}

            {confirmStop ? (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/70 p-5 text-center shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                        <p className="text-lg font-bold">Biztosan leállítod az élő adást?</p>
                        <p className="mt-2 text-sm text-white/70">A nézők azonnal elvesztik a közvetítést.</p>
                        <div className="mt-5 grid gap-2">
                            <button
                                type="button"
                                className="min-h-12 rounded-xl bg-[#25f4ee] font-bold text-black"
                                onClick={() => setConfirmStop(false)}
                            >
                                Adásban maradok
                            </button>
                            <button
                                type="button"
                                className="min-h-11 rounded-xl border border-red-400/40 text-sm font-semibold text-red-200"
                                onClick={() => void handleStop()}
                            >
                                Igen, leállítás
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {showCrisis && !confirmStop && !savingArchive ? (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/70 p-5 text-center shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                        <p className="text-lg font-bold">
                            {recovering || restoreBusy
                                ? "Újracsatlakozás..."
                                : !cameraLive
                                  ? "A kamera elveszett"
                                  : leftPage
                                    ? "Az oldal háttérbe került"
                                    : "A stream megszakadt"}
                        </p>
                        <p className="mt-2 text-sm text-white/80">
                            {mediaMessage ||
                                (leftPage
                                    ? "Ne hagyd el ezt az oldalt élő adás közben. Most megpróbáljuk helyreállítani."
                                    : signError || "Ellenőrizd a kamerát és a hálózatot, majd indítsd újra a kapcsolatot.")}
                        </p>
                        <div className="mt-5 grid gap-2">
                            <button
                                type="button"
                                disabled={Boolean(restoreBusy)}
                                className="min-h-12 rounded-xl bg-[#25f4ee] font-bold text-black disabled:opacity-50"
                                onClick={() => void runRestore("reconnect")}
                            >
                                Újracsatlakozás...
                            </button>
                            <button
                                type="button"
                                disabled={Boolean(restoreBusy)}
                                className="min-h-11 rounded-xl border border-white/15 bg-white/10 font-semibold disabled:opacity-50"
                                onClick={() => void runRestore("camera")}
                            >
                                {restoreBusy === "camera" ? "Újracsatlakozás..." : "Kamera újraindítása"}
                            </button>
                            <button
                                type="button"
                                disabled={Boolean(restoreBusy)}
                                className="min-h-11 rounded-xl border border-white/15 bg-white/10 font-semibold disabled:opacity-50"
                                onClick={() => void runRestore("stream")}
                            >
                                {restoreBusy === "stream" ? "Újracsatlakozás..." : "Stream helyreállítása"}
                            </button>
                            {leftPage && cameraLive && quality !== "critical" ? (
                                <button
                                    type="button"
                                    className="min-h-10 text-sm text-white/70 underline"
                                    onClick={() => setLeftPage(false)}
                                >
                                    Adásban vagyok
                                </button>
                            ) : null}
                            <StreamerHoldStop
                                disabled={busy || savingArchive}
                                busyLabel={savingArchive ? "Feltöltés…" : undefined}
                                onArmed={() => setConfirmStop(true)}
                            />
                        </div>
                    </div>
                </div>
            ) : null}
            {recall ? (
                <div className="absolute inset-x-4 top-1/4 z-30 rounded-2xl border border-white/15 bg-black/75 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                    <p className="text-lg font-semibold leading-snug">{question?.text || "Nincs kérdés"}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            className="rounded-xl bg-[#fe2c55] py-3 font-bold"
                            onClick={() => void rejectQuestion()}
                        >
                            Kérdés elvetése
                        </button>
                        <button type="button" className="rounded-xl bg-white/15 py-3 font-bold" onClick={() => setRecall(false)}>
                            Mégsem
                        </button>
                    </div>
                </div>
            ) : null}

            <div
                className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent px-[max(0.75rem,env(safe-area-inset-left),env(safe-area-inset-right))] ${
                    landscape
                        ? "pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-2"
                        : "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
                }`}
            >
                {expanded ? (
                    <div className="flex justify-end">
                        <button type="button" className={BTN} aria-label="Vezérlők" onClick={() => setExpanded(false)}>
                            <Maximize2 className="size-5" />
                        </button>
                    </div>
                ) : (
                    <>
                <StreamerReactionStats counts={reactionCounts} />
                {overlayOn && question?.text ? (
                    <p className={`mb-2 overflow-auto text-center font-semibold leading-snug drop-shadow ${landscape ? "max-h-10 text-sm" : "max-h-24 text-base"}`}>
                        ❓ {question.text}
                    </p>
                ) : (
                    <p className={`mb-2 text-center text-white/55 ${landscape ? "text-xs" : "text-sm"}`}>
                        {question ? "A kérdés eltűnt. Röviden: megválaszoltam. Hosszan: elvetés." : "Még nincs beküldött kérdés"}
                    </p>
                )}
                <div className={`mb-2 flex items-center justify-center gap-2 ${landscape ? "mb-1.5" : "mb-3"}`}>
                    <button type="button" className={landscape ? `${BTN} !h-10 !w-10 text-base` : BTN} aria-label="Kamera váltás" onClick={() => void camRef.current?.flipCamera()}>
                        <FlipHorizontal className={landscape ? "size-4" : "size-5"} />
                    </button>
                    <button
                        type="button"
                        className={`${landscape ? `${BTN} !h-10 !w-10 text-base` : BTN} ${micBroken && micOn ? "!border-red-400/60 !bg-red-600/90 text-white" : ""}`}
                        aria-label="Mikrofon"
                        onClick={() => {
                            const next = !micOn;
                            setMicOn(next);
                            camRef.current?.setMicEnabled(next);
                            if (!next) setMicBroken(false);
                        }}
                    >
                        {micOn ? (
                            <Mic className={`${landscape ? "size-4" : "size-5"} ${micBroken ? "text-white" : ""}`} />
                        ) : (
                            <MicOff className={landscape ? "size-4" : "size-5"} />
                        )}
                    </button>
                    <button
                        type="button"
                        className={landscape ? `${BTN} !h-10 !w-10 text-base` : BTN}
                        aria-label="Zoom be"
                        onClick={() => setZoom(camRef.current?.zoomBy(1) ?? Math.min(3, zoom + 0.15))}
                    >
                        <Plus className={landscape ? "size-4" : "size-5"} />
                    </button>
                    <button
                        type="button"
                        className={landscape ? `${BTN} !h-10 !w-10 text-base` : BTN}
                        aria-label="Zoom ki"
                        onClick={() => setZoom(camRef.current?.zoomBy(-1) ?? Math.max(1, zoom - 0.2))}
                    >
                        <Minus className={landscape ? "size-4" : "size-5"} />
                    </button>
                    <button
                        type="button"
                        className={landscape ? `${BTN} !h-10 !w-10 text-base` : BTN}
                        aria-label="Több kép, kevesebb gomb"
                        onClick={() => toggleFullscreen()}
                    >
                        <Maximize2 className={landscape ? "size-4" : "size-5"} />
                    </button>
                </div>
                <div className="flex flex-col items-center">
                <button
                    type="button"
                    disabled={qBusy || !question}
                    onPointerDown={onNextDown}
                    onPointerUp={onNextUp}
                    onPointerCancel={() => {
                        window.clearTimeout(pressTimer.current);
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`w-full touch-none rounded-2xl bg-gradient-to-r from-[#25f4ee] to-[#fe2c55] font-bold text-white shadow-[0_10px_28px_rgba(254,44,85,0.35)] disabled:opacity-60 ${landscape ? "min-h-11 text-base" : "min-h-14 text-lg"}`}
                >
                    {question ? "✅ Megválaszoltam, következő" : "Várakozás kérdésre"}
                </button>
                    <StreamerHoldStop
                        disabled={busy || savingArchive}
                        landscape={landscape}
                        busyLabel={savingArchive ? "Feltöltés…" : undefined}
                        onArmed={() => setConfirmStop(true)}
                    />
                </div>
                    </>
                )}
            </div>
        </div>
    );
}
