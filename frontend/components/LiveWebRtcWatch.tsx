"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Socket } from "socket.io-client";
import { livePeerConfig } from "@/lib/live-webrtc";
import { connectLiveSocket } from "@/lib/live-socket";
import { emitIce, fetchLanIps, rewriteSdpForLan } from "@/lib/ice-lan";

export default function LiveWebRtcWatch({
    showId,
    videoRef,
    onReady,
    onPreview,
    onStalled,
    onSocket,
}: {
    showId: string;
    videoRef: RefObject<HTMLVideoElement | null>;
    onReady: () => void;
    onPreview?: (url: string | null) => void;
    onStalled?: () => void;
    onSocket?: (socket: Socket | null) => void;
}) {
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onPreviewRef = useRef(onPreview);
    onPreviewRef.current = onPreview;
    const onStalledRef = useRef(onStalled);
    onStalledRef.current = onStalled;
    const onSocketRef = useRef(onSocket);
    onSocketRef.current = onSocket;
    const [hint, setHint] = useState("Kapcsolódás az élő adáshoz...");
    const [needsTap, setNeedsTap] = useState(false);

    useEffect(() => {
        if (!showId) return;
        let cancelled = false;
        let socket: Socket | null = null;
        let pc: RTCPeerConnection | null = null;
        let waitTimer: number | undefined;
        let joinTimer: number | undefined;
        let pollTimer: number | undefined;
        let webrtcLive = false;
        let gotPicture = false;
        let previewObjectUrl = "";

        function stallWebrtc() {
            if (!webrtcLive) return;
            webrtcLive = false;
            onStalledRef.current?.();
        }

        function showJpeg(url: string) {
            if (!url) return;
            gotPicture = true;
            if (waitTimer) window.clearTimeout(waitTimer);
            onPreviewRef.current?.(url);
            if (!webrtcLive) setHint("");
        }

        function bindMedia(video: HTMLVideoElement, media: MediaStream) {
            video.removeAttribute("src");
            video.srcObject = media;
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            playVideo();
        }

        function playVideo() {
            const video = videoRef.current;
            if (!video) return;
            video.playsInline = true;
            video.muted = true;
            const play = video.play();
            if (play) {
                play.then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
            }
        }

        async function pullPreview() {
            if (cancelled) return;
            try {
                const res = await fetch(`/api/live-preview/${encodeURIComponent(showId)}?t=${Date.now()}`, {
                    credentials: "include",
                    cache: "no-store",
                });
                if (!res.ok || res.status === 204) return;
                const blob = await res.blob();
                if (!blob.size || cancelled) return;
                if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
                previewObjectUrl = URL.createObjectURL(blob);
                showJpeg(previewObjectUrl);
            } catch {
                /* a következő körben újrapróbál */
            }
        }

        void pullPreview();
        pollTimer = window.setInterval(() => void pullPreview(), 4000);

        (async () => {
            const lanIps = await fetchLanIps();
            try {
                socket = await connectLiveSocket(false);
            } catch {
                if (!gotPicture) {
                    setHint("Várakozás a kamera képére... Ha a telefonon megy az élő, a kép hamarosan megjelenik.");
                }
                return;
            }
            if (cancelled) {
                socket.disconnect();
                return;
            }
            onSocketRef.current?.(socket);
            waitTimer = window.setTimeout(() => {
                if (!gotPicture) {
                    setHint("Várakozás a tartalomkészítő kamerájára... Hagyd a telefonon bekapcsolva az élőt, majd itt frissíts.");
                }
            }, 12000);
            const join = () => {
                if (!gotPicture) setHint("Várakozás a tartalomkészítő kamerájára...");
                socket?.emit("live:viewer", { showId });
            };
            socket.on("connect", join);
            if (socket.connected) join();
            joinTimer = window.setInterval(join, 8000);
            socket.on("connect_error", () => {
                if (!socket?.connected && !gotPicture) {
                    setHint("Jelzés újrapróbálása...");
                }
            });
            socket.on("live:error", (payload: { message?: string }) => {
                if (payload?.message && !gotPicture) setHint(payload.message);
            });
            socket.on("live:frame", (payload: { mime?: string; data?: string }) => {
                const data = String(payload?.data || "");
                if (cancelled || !data) return;
                showJpeg(`data:${payload?.mime || "image/jpeg"};base64,${data}`);
                if (pollTimer) {
                    window.clearInterval(pollTimer);
                    pollTimer = window.setInterval(() => void pullPreview(), 8000);
                }
            });
            socket.on("live:offer", async (payload: { sdp?: RTCSessionDescriptionInit; viewerId?: string }) => {
                const video = videoRef.current;
                if (payload?.viewerId && socket?.id && payload.viewerId !== socket.id) return;
                if (cancelled || !payload?.sdp || !video) return;
                const remote = payload.sdp;
                const remoteSdp = {
                    type: remote.type,
                    sdp: rewriteSdpForLan(String(remote.sdp || ""), lanIps),
                };
                const attachTrack = (ev: RTCTrackEvent) => {
                    webrtcLive = true;
                    gotPicture = true;
                    if (waitTimer) window.clearTimeout(waitTimer);
                    const media = ev.streams[0] || new MediaStream([ev.track]);
                    bindMedia(video, media);
                    setHint("");
                    onReadyRef.current();
                    ev.track.onmute = () => stallWebrtc();
                    ev.track.onended = () => stallWebrtc();
                    ev.track.onunmute = () => {
                        webrtcLive = true;
                        bindMedia(video, media);
                        onReadyRef.current();
                    };
                };
                pc?.close();
                pc = new RTCPeerConnection(livePeerConfig());
                pc.addTransceiver("video", { direction: "recvonly" });
                pc.addTransceiver("audio", { direction: "recvonly" });
                pc.ontrack = attachTrack;
                pc.oniceconnectionstatechange = () => {
                    const ice = pc?.iceConnectionState;
                    if (ice === "failed" || ice === "disconnected") stallWebrtc();
                };
                pc.onicecandidate = (ev) => {
                    emitIce(
                        (candidate) => socket?.emit("live:ice", { showId, from: "view", candidate }),
                        ev.candidate,
                        lanIps,
                    );
                };
                await pc.setRemoteDescription(remoteSdp).catch(() => undefined);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket?.emit("live:answer", {
                    showId,
                    sdp: {
                        type: answer.type,
                        sdp: rewriteSdpForLan(String(pc.localDescription?.sdp || answer.sdp || ""), lanIps),
                    },
                });
            });
            socket.on("live:ice", async (payload: { candidate?: RTCIceCandidateInit; viewerId?: string }) => {
                if (payload?.viewerId && socket?.id && payload.viewerId !== socket.id) return;
                if (pc && payload?.candidate) await pc.addIceCandidate(payload.candidate).catch(() => undefined);
            });
            socket.on("live:ended", () => {
                stallWebrtc();
                const video = videoRef.current;
                if (video) video.srcObject = null;
                setHint("Az élő kamera leállt.");
            });
        })();

        return () => {
            cancelled = true;
            if (waitTimer) window.clearTimeout(waitTimer);
            if (joinTimer) window.clearInterval(joinTimer);
            if (pollTimer) window.clearInterval(pollTimer);
            if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
            pc?.close();
            socket?.disconnect();
            onSocketRef.current?.(null);
        };
    }, [showId, videoRef]);

    function tapToPlay() {
        const video = videoRef.current;
        if (!video) return;
        video.muted = false;
        void video.play().then(() => setNeedsTap(false)).catch(() => undefined);
    }

    if (!hint && !needsTap) return null;

    return (
        <div className="mb-2">
            {hint ? <p className="text-sm text-zinc-400">{hint}</p> : null}
            {needsTap ? (
                <button
                    type="button"
                    className="mt-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold"
                    onClick={tapToPlay}
                >
                    Koppints a lejátszáshoz
                </button>
            ) : null}
        </div>
    );
}
