"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { livePeerConfig } from "@/lib/live-webrtc";
import { connectLiveSocket } from "@/lib/live-socket";
import { emitIce } from "@/lib/ice-lan";
import { apiFetch } from "@/api/http";
import { fetchLiveVideoConfig, fetchLivekitToken, scheduleTokenRefresh } from "@/lib/livekit-session";
import {
    ConnectionState,
    ConnectionQuality,
    RoomEvent,
    connectLivekitRoom,
    disconnectLivekitRoom,
    publishMediaStream,
    replaceLivekitTrack,
    type Room,
} from "@/lib/livekit-room";
import type { LiveLinkQuality } from "@/lib/live-link-quality";
import type { ReactionCounts } from "@/lib/live-reactions";
export type { LiveLinkQuality };

export type StreamerLiveCameraHandle = {
    flipCamera: () => Promise<void>;
    setMicEnabled: (on: boolean) => void;
    zoomBy: (delta: number) => number;
    stopRecording: () => Promise<Blob | null>;
    restartCamera: () => Promise<boolean>;
    restoreStream: () => Promise<boolean>;
};

type Props = {
    stream: MediaStream | null;
    showId: string;
    fill?: boolean;
    zoomPreview?: number;
    onLink?: (quality: LiveLinkQuality, reconnecting: boolean) => void;
    onAudioBroken?: (broken: boolean) => void;
    onSignalingError?: (message: string) => void;
    onMediaHealth?: (state: { cameraLive: boolean; recovering: boolean; message?: string }) => void;
    onReaction?: (payload: {
        reactionType?: string;
        value?: string;
        emoji?: string;
        ts: number;
        counts?: ReactionCounts;
    }) => void;
    onReactionCounts?: (counts: ReactionCounts) => void;
};

function qualityFromStats(opts: {
    socketOk: boolean;
    iceBad: boolean;
    loss: number;
    rtt: number;
}): LiveLinkQuality {
    if (!opts.socketOk || opts.iceBad) return "critical";
    if (opts.loss > 0.12 || opts.rtt > 600) return "poor";
    if (opts.loss > 0.04 || opts.rtt > 250) return "fair";
    return "good";
}

const StreamerLiveCamera = forwardRef<StreamerLiveCameraHandle, Props>(function StreamerLiveCamera(
    { stream, showId, fill, zoomPreview = 1, onLink, onAudioBroken, onSignalingError, onMediaHealth, onReaction, onReactionCounts },
    ref,
) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const livekitRoomRef = useRef<Room | null>(null);
    const streamRef = useRef(stream);
    const facingRef = useRef<"user" | "environment">("user");
    const zoomRef = useRef(1);
    const lastAudioBytes = useRef(0);
    const audioStall = useRef(0);
    const onLinkRef = useRef(onLink);
    const onAudioRef = useRef(onAudioBroken);
    const onErrRef = useRef(onSignalingError);
    const onHealthRef = useRef(onMediaHealth);
    const onReactionRef = useRef(onReaction);
    const onCountsRef = useRef(onReactionCounts);
    onLinkRef.current = onLink;
    onAudioRef.current = onAudioBroken;
    onErrRef.current = onSignalingError;
    onHealthRef.current = onMediaHealth;
    onReactionRef.current = onReaction;
    onCountsRef.current = onReactionCounts;
    streamRef.current = stream;
    const [error, setError] = useState("");
    const skipEndedRef = useRef(false);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const recChunksRef = useRef<Blob[]>([]);
    const recMimeRef = useRef("");

    const recreateViewersRef = useRef<(ids?: string[]) => Promise<void>>(async () => undefined);
    const recoverVideoRef = useRef<() => Promise<boolean>>(async () => false);
    const publishedBackendRef = useRef<"mesh" | "livekit" | null>(null);

    async function publishNewVideo(next: MediaStreamTrack) {
        const current = streamRef.current;
        if (!current) return;
        const old = current.getVideoTracks().filter((track) => track !== next);
        if (!current.getVideoTracks().includes(next)) current.addTrack(next);
        old.forEach((track) => {
            current.removeTrack(track);
            track.stop();
        });
        if (videoRef.current) {
            videoRef.current.srcObject = current;
            void videoRef.current.play().catch(() => undefined);
        }
        await replacePeerTracks(peersRef.current, next);
        if (livekitRoomRef.current) {
            await replaceLivekitTrack(livekitRoomRef.current, next).catch(() => undefined);
        }
        const viewerIds = [...peersRef.current.keys()];
        await recreateViewersRef.current(viewerIds);
        next.addEventListener("ended", () => {
            void recoverVideoRef.current();
        });
    }

    useImperativeHandle(ref, () => ({
        async flipCamera() {
            const current = streamRef.current;
            if (!current) return;
            const previousFacing = facingRef.current;
            const nextFacing = previousFacing === "user" ? "environment" : "user";
            skipEndedRef.current = true;
            const hold = makeHoldTrack();
            try {
                await replacePeerTracks(peersRef.current, hold.track);
                current.getVideoTracks().forEach((track) => {
                    current.removeTrack(track);
                    track.stop();
                });
                await waitMs(350);
                facingRef.current = nextFacing;
                const media = await openCamera({ facing: nextFacing, videoOnly: true });
                const next = media.getVideoTracks()[0];
                if (!next) throw new Error("A kamera nem adott videósávot.");
                await publishNewVideo(next);
                hold.stop();
                setError("");
            } catch (err: unknown) {
                hold.stop();
                facingRef.current = previousFacing;
                const message = cameraErrorHu(err);
                setError(message);
                onErrRef.current?.(message);
                try {
                    await waitMs(400);
                    const fallback = await openCamera({ facing: previousFacing, videoOnly: true });
                    const track = fallback.getVideoTracks()[0];
                    if (track) await publishNewVideo(track);
                } catch {
                    /* keep error */
                }
            } finally {
                skipEndedRef.current = false;
            }
        },
        setMicEnabled(on: boolean) {
            streamRef.current?.getAudioTracks().forEach((t) => {
                t.enabled = on;
            });
            if (!on) {
                audioStall.current = 0;
                onAudioRef.current?.(false);
            }
        },
        zoomBy(delta: number) {
            const track = streamRef.current?.getVideoTracks()[0];
            const caps = track?.getCapabilities?.() as { zoom?: { min: number; max: number } } | undefined;
            if (track && caps?.zoom) {
                const settings = track.getSettings() as { zoom?: number };
                const step = (caps.zoom.max - caps.zoom.min) / 8;
                const next = Math.min(
                    caps.zoom.max,
                    Math.max(caps.zoom.min, (settings.zoom || caps.zoom.min) + Math.sign(delta) * step),
                );
                void track.applyConstraints({ advanced: [{ zoom: next }] as unknown as MediaTrackConstraintSet[] }).catch(() => undefined);
                zoomRef.current = 1;
                return 1;
            }
            zoomRef.current = Math.min(3, Math.max(1, zoomRef.current + Math.sign(delta) * 0.2));
            return zoomRef.current;
        },
        stopRecording() {
            return stopLiveRecorder(recorderRef, recChunksRef, recMimeRef);
        },
        async restartCamera() {
            return recoverVideoRef.current();
        },
        async restoreStream() {
            const sock = socketRef.current;
            if (sock && !sock.connected) sock.connect();
            if (sock?.connected) {
                const videoBackend = publishedBackendRef.current;
                if (videoBackend) sock.emit("live:publisher", { showId, videoBackend });
            }
            const video = streamRef.current?.getVideoTracks().find((t) => t.readyState === "live");
            if (!video) {
                const ok = await recoverVideoRef.current();
                if (!ok) return false;
            }
            try {
                const media = streamRef.current;
                let room = livekitRoomRef.current;
                if (media && room) {
                    if (room.state !== ConnectionState.Connected) {
                        const issued = await fetchLivekitToken(showId, "publisher");
                        await disconnectLivekitRoom(room);
                        room = await connectLivekitRoom(issued.url, issued.token);
                        livekitRoomRef.current = room;
                        await publishMediaStream(room, media);
                    } else {
                        for (const track of media.getTracks()) {
                            if (track.readyState === "ended") continue;
                            await replaceLivekitTrack(room, track).catch(() => undefined);
                        }
                    }
                }
                await recreateViewersRef.current();
                return true;
            } catch {
                return false;
            }
        },
    }));

    useEffect(() => {
        const video = videoRef.current;
        if (video) {
            video.setAttribute("playsinline", "true");
            video.setAttribute("webkit-playsinline", "true");
            video.srcObject = stream;
        }
        if (stream && video) void video.play().catch(() => undefined);
        if (!stream || !showId) return;

        startLiveRecorder(stream, recorderRef, recChunksRef, recMimeRef);

        let cancelled = false;
        let beat = 0;
        let frames = 0;
        let statsTimer = 0;
        let clearLkRefresh = () => undefined as void;
        let removeVis = () => undefined as void;
        let plannedLk = false;

        async function attachViewer(socket: Socket, viewerId: string, force = false) {
            const media = streamRef.current;
            if (!media) return;
            const existing = peersRef.current.get(viewerId);
            if (existing && !force) {
                const ice = existing.iceConnectionState;
                if (ice === "connected" || ice === "completed") return;
                if (
                    (ice === "new" || ice === "checking") &&
                    existing.signalingState === "have-local-offer" &&
                    existing.localDescription
                ) {
                    socket.emit("live:offer", {
                        showId,
                        viewerId,
                        sdp: {
                            type: existing.localDescription.type,
                            sdp: String(existing.localDescription.sdp || ""),
                        },
                    });
                    return;
                }
            }
            if (existing) {
                existing.close();
                peersRef.current.delete(viewerId);
            }
            const pc = new RTCPeerConnection(livePeerConfig());
            peersRef.current.set(viewerId, pc);
            for (const track of media.getTracks()) {
                if (track.readyState === "ended") continue;
                pc.addTrack(track, media);
            }
            pc.onicecandidate = (ev) => {
                emitIce(
                    (candidate) => {
                        socket.emit("live:ice", {
                            showId,
                            viewerId,
                            from: "pub",
                            candidate,
                        });
                    },
                    ev.candidate,
                    [],
                );
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const sdp = {
                type: offer.type,
                sdp: String(pc.localDescription?.sdp || offer.sdp || ""),
            };
            socket.emit("live:offer", { showId, viewerId, sdp });
        }

        (async () => {
            try {
                const socket = await connectLiveSocket(true);
                if (cancelled) {
                    socket.disconnect();
                    return;
                }
                socketRef.current = socket;
                const videoCfg = await fetchLiveVideoConfig(showId);
                if (cancelled) {
                    socket.disconnect();
                    return;
                }
                const useLivekit = videoCfg.plannedBackend === "livekit";
                const publish = (videoBackend: "mesh" | "livekit") => {
                    publishedBackendRef.current = videoBackend;
                    socket.emit("live:publisher", { showId, videoBackend });
                    if (socket.connected && videoBackend === "mesh") onLinkRef.current?.("good", false);
                };
                socket.on("disconnect", () => onLinkRef.current?.("critical", true));
                socket.on("reconnect_attempt", () => onLinkRef.current?.("critical", true));

                if (useLivekit) {
                    const mapQuality = (q: ConnectionQuality): LiveLinkQuality => {
                        if (q === ConnectionQuality.Excellent || q === ConnectionQuality.Good) return "good";
                        if (q === ConnectionQuality.Poor) return "fair";
                        return "critical";
                    };
                    async function connectPublisherRoom() {
                        const issued = await fetchLivekitToken(showId, "publisher");
                        if (cancelled) return;
                        plannedLk = true;
                        try {
                            const prev = livekitRoomRef.current;
                            await disconnectLivekitRoom(prev);
                            const room = await connectLivekitRoom(issued.url, issued.token);
                            livekitRoomRef.current = room;
                            if (streamRef.current) await publishMediaStream(room, streamRef.current);
                            const emitLink = () => {
                                const connected = room.state === ConnectionState.Connected;
                                onLinkRef.current?.(
                                    connected ? mapQuality(room.localParticipant.connectionQuality) : "critical",
                                    !connected,
                                );
                            };
                            room.on(RoomEvent.ConnectionQualityChanged, emitLink);
                            room.on(RoomEvent.ConnectionStateChanged, emitLink);
                            emitLink();
                            clearLkRefresh();
                            clearLkRefresh = scheduleTokenRefresh(issued.expiresIn, () => {
                                if (cancelled) return;
                                void connectPublisherRoom().catch(() => onLinkRef.current?.("critical", true));
                            });
                        } finally {
                            plannedLk = false;
                        }
                    }
                    await connectPublisherRoom();
                    socket.on("connect", () => publish("livekit"));
                    if (socket.connected) publish("livekit");
                    beat = window.setInterval(() => publish("livekit"), 4000);
                    recreateViewersRef.current = async () => {
                        const media = streamRef.current;
                        const current = livekitRoomRef.current;
                        if (!media) return;
                        if (!current || current.state !== ConnectionState.Connected) {
                            if (plannedLk) return;
                            await connectPublisherRoom();
                            return;
                        }
                        for (const track of media.getTracks()) {
                            if (track.readyState === "ended") continue;
                            await replaceLivekitTrack(current, track).catch(() => undefined);
                        }
                    };
                    const onVis = () => {
                        if (document.visibilityState !== "visible" || cancelled) return;
                        void recreateViewersRef.current();
                    };
                    document.addEventListener("visibilitychange", onVis);
                    removeVis = () => document.removeEventListener("visibilitychange", onVis);
                } else {
                socket.on("connect", () => publish("mesh"));
                if (socket.connected) publish("mesh");
                beat = window.setInterval(() => publish("mesh"), 4000);
                recreateViewersRef.current = async (ids) => {
                    const sock = socketRef.current;
                    if (!sock) return;
                    const list = ids?.length ? ids : [...peersRef.current.keys()];
                    for (const id of list) await attachViewer(sock, id, true);
                };
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                frames = window.setInterval(() => {
                    const preview = videoRef.current;
                    if (!preview || !ctx || preview.videoWidth < 2) return;
                    const w = 320;
                    const h = Math.max(1, Math.round((w * preview.videoHeight) / preview.videoWidth));
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(preview, 0, 0, w, h);
                    canvas.toBlob((blob) => {
                        if (!blob) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                            const url = String(reader.result || "");
                            const data = url.slice(url.indexOf(",") + 1);
                            if (!data || cancelled) return;
                            socket.emit("live:frame", { showId, mime: blob.type || "image/jpeg", data });
                            void apiFetch(`/live-preview/${encodeURIComponent(showId)}`, {
                                method: "POST",
                                body: JSON.stringify({ mime: blob.type || "image/jpeg", data }),
                            }).catch(() => undefined);
                        };
                        reader.readAsDataURL(blob);
                    }, "image/jpeg", 0.38);
                }, 500);
                statsTimer = window.setInterval(async () => {
                    const socketOk = Boolean(socketRef.current?.connected);
                    let loss = 0;
                    let rtt = 0;
                    let iceBad = false;
                    let audioBytes = 0;
                    let samples = 0;
                    for (const pc of peersRef.current.values()) {
                        const ice = pc.iceConnectionState;
                        if (ice === "failed" || ice === "disconnected" || ice === "closed") iceBad = true;
                        try {
                            const report = await pc.getStats();
                            report.forEach((row) => {
                                if (row.type === "remote-inbound-rtp" && row.kind === "video") {
                                    loss = Math.max(loss, Number(row.fractionLost || 0));
                                    rtt = Math.max(rtt, Number(row.roundTripTime || 0) * 1000);
                                    samples += 1;
                                }
                                if (row.type === "outbound-rtp" && row.kind === "audio") {
                                    audioBytes += Number(row.bytesSent || 0);
                                }
                            });
                        } catch {
                            /* ignore */
                        }
                    }
                    if (!samples && peersRef.current.size === 0) iceBad = false;
                    onLinkRef.current?.(qualityFromStats({ socketOk, iceBad: iceBad && peersRef.current.size > 0, loss, rtt }), !socketOk);
                    const micOn = streamRef.current?.getAudioTracks().some((t) => t.enabled && t.readyState === "live") ?? false;
                    if (micOn && peersRef.current.size > 0) {
                        if (audioBytes <= lastAudioBytes.current) audioStall.current += 1;
                        else audioStall.current = 0;
                        lastAudioBytes.current = audioBytes;
                        onAudioRef.current?.(audioStall.current >= 3);
                    }
                }, 2000);
                socket.on("live:viewer", (payload: { viewerId?: string }) => {
                    const id = String(payload?.viewerId || "");
                    if (id) void attachViewer(socket, id);
                });
                socket.on("live:answer", async (payload: { viewerId?: string; sdp?: RTCSessionDescriptionInit }) => {
                    const pc = peersRef.current.get(String(payload?.viewerId || ""));
                    if (pc && payload?.sdp) await pc.setRemoteDescription(payload.sdp).catch(() => undefined);
                });
                socket.on("live:ice", async (payload: { viewerId?: string; candidate?: RTCIceCandidateInit }) => {
                    const pc = peersRef.current.get(String(payload?.viewerId || ""));
                    if (pc && payload?.candidate) await pc.addIceCandidate(payload.candidate).catch(() => undefined);
                });
                socket.on("live:viewer-left", (payload: { viewerId?: string }) => {
                    const id = String(payload?.viewerId || "");
                    peersRef.current.get(id)?.close();
                    peersRef.current.delete(id);
                });
                }
                socket.on("live:error", (payload: { message?: string }) => {
                    const message = String(payload?.message || "");
                    if (!message) return;
                    setError(message);
                    onErrRef.current?.(message);
                });
                socket.on("live:reaction", (payload: {
                    reactionType?: string;
                    value?: string;
                    emoji?: string;
                    ts?: number;
                    counts?: ReactionCounts;
                }) => {
                    const next = String(payload?.value || payload?.emoji || "").trim();
                    if (!next) return;
                    onReactionRef.current?.({
                        reactionType: payload?.reactionType,
                        value: next,
                        emoji: next,
                        ts: Number(payload?.ts) || Date.now(),
                        counts: payload?.counts,
                    });
                });
                socket.on("live:reactions", (payload: { counts?: ReactionCounts }) => {
                    if (payload?.counts) onCountsRef.current?.(payload.counts);
                });
            } catch (err: unknown) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : "Hitelesítés szükséges. Lépj be újra tartalomkészítőként.";
                    setError(message);
                    onErrRef.current?.(message);
                    onLinkRef.current?.("critical", true);
                }
            }
        })();

        const recoverVideo = async () => {
            if (skipEndedRef.current || cancelled) return false;
            const current = streamRef.current;
            if (!current) return false;
            skipEndedRef.current = true;
            onHealthRef.current?.({ cameraLive: false, recovering: true, message: "Újracsatlakozás..." });
            const hold = makeHoldTrack();
            try {
                await replacePeerTracks(peersRef.current, hold.track);
                current.getVideoTracks().forEach((track) => {
                    current.removeTrack(track);
                    track.stop();
                });
                await waitMs(400);
                const media = await openCamera({ facing: facingRef.current, videoOnly: true });
                const next = media.getVideoTracks()[0];
                if (!next) {
                    onHealthRef.current?.({
                        cameraLive: false,
                        recovering: false,
                        message: "A kamera nem adott videósávot.",
                    });
                    return false;
                }
                await publishNewVideo(next);
                hold.stop();
                setError("");
                onHealthRef.current?.({ cameraLive: true, recovering: false });
                return true;
            } catch (err: unknown) {
                hold.stop();
                const message = cameraErrorHu(err);
                setError(message);
                onErrRef.current?.(message);
                onHealthRef.current?.({ cameraLive: false, recovering: false, message });
                return false;
            } finally {
                skipEndedRef.current = false;
            }
        };
        stream.getVideoTracks().forEach((track) => {
            track.addEventListener("ended", recoverVideo);
        });
        recoverVideoRef.current = () => recoverVideo();

        return () => {
            cancelled = true;
            removeVis();
            clearLkRefresh();
            if (beat) window.clearInterval(beat);
            if (frames) window.clearInterval(frames);
            if (statsTimer) window.clearInterval(statsTimer);
            stream.getVideoTracks().forEach((track) => track.removeEventListener("ended", recoverVideo));
            for (const pc of peersRef.current.values()) pc.close();
            peersRef.current.clear();
            const lk = livekitRoomRef.current;
            livekitRoomRef.current = null;
            void disconnectLivekitRoom(lk);
            socketRef.current?.disconnect();
            socketRef.current = null;
            publishedBackendRef.current = null;
            const rec = recorderRef.current;
            if (rec && rec.state !== "inactive") {
                try {
                    rec.stop();
                } catch {
                    /* ignore */
                }
            }
        };
    }, [stream, showId]);

    if (!stream) return null;

    return (
        <div className={fill ? "absolute inset-0 bg-black" : "rounded-2xl bg-black"}>
            <video
                ref={videoRef}
                className={
                    fill
                        ? "h-full w-full bg-black object-cover"
                        : "aspect-video w-full rounded-2xl bg-black object-cover"
                }
                style={zoomPreview > 1.01 ? { transform: `scale(${zoomPreview})`, transformOrigin: "center" } : undefined}
                autoPlay
                playsInline
                muted
            />
            {error ? (
                <p className="pointer-events-none absolute inset-x-3 top-16 z-10 rounded-xl bg-black/75 px-3 py-2 text-center text-sm text-red-300">
                    {error}
                </p>
            ) : null}
        </div>
    );
});

export default StreamerLiveCamera;

export function phoneHttpsLiveUrl() {
    if (typeof window === "undefined") return "";
    const host = window.location.hostname;
    const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
    const path = window.location.pathname + window.location.search;
    return `https://${host}${port && port !== "443" ? `:${port}` : ""}${path}`;
}

function waitMs(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function cameraErrorHu(err: unknown) {
    const name = err instanceof DOMException ? err.name : "";
    const raw = err instanceof Error ? err.message : String(err || "");
    if (
        name === "NotAllowedError" ||
        name === "PermissionDeniedError" ||
        /permission denied/i.test(raw) ||
        /notallowederror/i.test(raw)
    ) {
        return "A böngésző nem engedte a kamerát. Zárd be ezt a fület, nyisd újra az élő oldalt, a címsorban (lakat / kamera ikon) legyen Engedélyezve, majd indítsd újra. Chrome vagy Safari kell, ne Facebook/Instagram ablak.";
    }
    if (name === "NotFoundError") return "A telefon nem talált kamerát vagy mikrofont.";
    if (name === "OverconstrainedError") {
        return "Ez a kamera nem tudja a kért beállítást. Próbáld újra, vagy fordítsd meg a telefont.";
    }
    if (name === "NotReadableError" || /could not start video source/i.test(raw) || /notreadableerror/i.test(raw)) {
        return "A telefon kameráját most nem lehet elindítani. Zárd be teljesen a Kamerát, Instagramot és a többi böngészőfület, használd a Chrome vagy Safari appot (ne Facebook/Instagram ablakot), majd frissítsd az oldalt és indítsd újra. A 🔄 gombot élő közben ne nyomd, amíg ez a hiba megvan.";
    }
    if (name === "AbortError") return "A kamera indítását a telefon megszakította. Nyomd meg újra az Élő indítását.";
    if (name === "SecurityError") return "HTTPS kell a kamerához. Telefonon a Cloudflare tunnel címet nyisd.";
    return raw && raw.length < 180 ? raw : "Nem sikerült elindítani a kamerát és a mikrofont.";
}

let gumQueue: Promise<unknown> = Promise.resolve();

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = gumQueue.then(fn, fn);
    gumQueue = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

async function pickCameraId(facing: "user" | "environment") {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videos = devices.filter((d) => d.kind === "videoinput");
        const wantBack = facing === "environment";
        const match = videos.find((d) => {
            const label = d.label.toLowerCase();
            const back = /back|rear|environment|hátsó|hatso/.test(label);
            const front = /front|user|face|elöl|elol|elő/.test(label);
            return wantBack ? back : front;
        });
        return match?.deviceId || "";
    } catch {
        return "";
    }
}

async function openCamera(opts: { facing: "user" | "environment"; videoOnly?: boolean }) {
    if (!window.isSecureContext) {
        throw new Error(
            "A kamera csak biztonságos kapcsolaton (HTTPS) engedélyezett. Nyisd meg az oldalt a szokásos webcímen.",
        );
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Ez a böngésző nem tud kamerát indítani.");
    }
    return runExclusive(async () => {
        const deviceId = await pickCameraId(opts.facing);
        const video: boolean | MediaTrackConstraints = deviceId
            ? { deviceId: { ideal: deviceId } }
            : true;
        try {
            return await navigator.mediaDevices.getUserMedia(
                opts.videoOnly ? { audio: false, video } : { audio: true, video },
            );
        } catch (first) {
            await waitMs(450);
            try {
                return await navigator.mediaDevices.getUserMedia(
                    opts.videoOnly ? { audio: false, video: true } : { audio: true, video: true },
                );
            } catch (second) {
                if (!opts.videoOnly) {
                    await waitMs(450);
                    const onlyVideo = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
                    try {
                        const audio = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                        audio.getAudioTracks().forEach((track) => onlyVideo.addTrack(track));
                    } catch {
                        /* video-only */
                    }
                    return onlyVideo;
                }
                throw new Error(cameraErrorHu(second || first));
            }
        }
    });
}

async function replacePeerTracks(peers: Map<string, RTCPeerConnection>, track: MediaStreamTrack) {
    for (const pc of peers.values()) {
        const sender =
            pc.getSenders().find((s) => s.track?.kind === track.kind) ||
            pc.getSenders().find((s) => !s.track && track.kind === "video");
        await sender?.replaceTrack(track).catch(() => undefined);
    }
}

function makeHoldTrack() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 36;
    const ctx = canvas.getContext("2d");
    const paint = () => {
        if (!ctx) return;
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    paint();
    const stream = canvas.captureStream(5);
    const track = stream.getVideoTracks()[0];
    const timer = window.setInterval(paint, 200);
    return {
        track,
        stop() {
            window.clearInterval(timer);
            track.stop();
        },
    };
}

function pickRecorderMime() {
    const types = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp8,opus",
        "video/webm",
    ];
    if (typeof MediaRecorder === "undefined") return "";
    return types.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
}

function startLiveRecorder(
    stream: MediaStream,
    recorderRef: { current: MediaRecorder | null },
    chunksRef: { current: Blob[] },
    mimeRef: { current: string },
) {
    if (typeof MediaRecorder === "undefined") return;
    if (recorderRef.current && recorderRef.current.state !== "inactive") return;
    chunksRef.current = [];
    const mime = pickRecorderMime();
    mimeRef.current = mime;
    try {
        const rec = mime
            ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_200_000 })
            : new MediaRecorder(stream);
        rec.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
        };
        rec.start(4000);
        recorderRef.current = rec;
        mimeRef.current = rec.mimeType || mime;
    } catch {
        recorderRef.current = null;
    }
}

function stopLiveRecorder(
    recorderRef: { current: MediaRecorder | null },
    chunksRef: { current: Blob[] },
    mimeRef: { current: string },
): Promise<Blob | null> {
    const rec = recorderRef.current;
    recorderRef.current = null;
    const finish = () => {
        const chunks = chunksRef.current;
        chunksRef.current = [];
        if (!chunks.length) return null;
        const blob = new Blob(chunks, { type: mimeRef.current || "video/webm" });
        return blob.size >= 4096 ? blob : null;
    };
    if (!rec || rec.state === "inactive") {
        return Promise.resolve(finish());
    }
    return new Promise((resolve) => {
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            resolve(finish());
        };
        rec.onstop = done;
        try {
            rec.requestData?.();
            rec.stop();
        } catch {
            done();
            return;
        }
        window.setTimeout(done, 3000);
    });
}

export async function startStreamerMedia(facing: "user" | "environment" = "user") {
    return openCamera({ facing, videoOnly: false });
}

export function stopStreamerMedia(stream: MediaStream | null) {
    stream?.getTracks().forEach((t) => t.stop());
}
