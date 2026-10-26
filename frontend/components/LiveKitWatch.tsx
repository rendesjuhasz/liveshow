"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Socket } from "socket.io-client";
import { connectLiveSocket } from "@/lib/live-socket";
import { fetchLivekitToken, scheduleTokenRefresh } from "@/lib/livekit-session";
import { ApiError } from "@/api/http";
import type { RemoteTrack } from "livekit-client";
import {
    Room,
    RoomEvent,
    Track,
    attachRemoteTrack,
    connectLivekitRoom,
    disconnectLivekitRoom,
} from "@/lib/livekit-room";

export default function LiveKitWatch({
    showId,
    videoRef,
    onReady,
    onStalled,
    onSocket,
    onError,
    onEnded,
}: {
    showId: string;
    videoRef: RefObject<HTMLVideoElement | null>;
    onReady: () => void;
    onStalled?: () => void;
    onSocket?: (socket: Socket | null) => void;
    onError?: (message: string) => void;
    onEnded?: () => void;
}) {
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onStalledRef = useRef(onStalled);
    onStalledRef.current = onStalled;
    const onSocketRef = useRef(onSocket);
    onSocketRef.current = onSocket;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;
    const [needsTap, setNeedsTap] = useState(false);

    useEffect(() => {
        if (!showId) return;
        let cancelled = false;
        let planned = false;
        let socket: Socket | null = null;
        let room: Room | null = null;
        let clearRefresh = () => undefined as void;
        let stallRetry = 0;
        let stallRetries = 0;
        let joinTimer = 0;

        function stall() {
            onStalledRef.current?.();
        }

        function isLivekitTokenError(err: unknown) {
            if (err instanceof ApiError) return true;
            const message = err instanceof Error ? err.message : "";
            return /livekit|token/i.test(message);
        }

        function fail(err: unknown) {
            onErrorRef.current?.(err instanceof Error ? err.message : "Az élő adás nem elérhető.");
            stall();
            if (isLivekitTokenError(err)) stallRetries = 99;
        }

        function bindTrack(track: RemoteTrack) {
            const video = videoRef.current;
            if (!video || cancelled) return;
            if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
                attachRemoteTrack(track, video);
            }
            if (track.kind === Track.Kind.Video) {
                video.muted = true;
                void video.play().then(() => setNeedsTap(true)).catch(() => setNeedsTap(true));
                onReadyRef.current();
            }
        }

        async function join() {
            const issued = await fetchLivekitToken(showId, "viewer");
            if (cancelled) return;
            planned = true;
            try {
                if (room) await disconnectLivekitRoom(room);
                room = await connectLivekitRoom(issued.url, issued.token);
            } finally {
                planned = false;
            }
            if (!room) return;
            room.on(RoomEvent.TrackSubscribed, (track) => bindTrack(track));
            room.on(RoomEvent.TrackUnsubscribed, () => stall());
            room.on(RoomEvent.Disconnected, () => {
                stall();
                if (cancelled || planned) return;
                if (stallRetries >= 5) return;
                stallRetries += 1;
                if (stallRetry) window.clearTimeout(stallRetry);
                stallRetry = window.setTimeout(() => {
                    void join().catch((err: unknown) => {
                        if (cancelled) return;
                        fail(err);
                    });
                }, Math.min(8_000, 1_000 * stallRetries));
            });
            room.remoteParticipants.forEach((p) => {
                p.trackPublications.forEach((pub) => {
                    if (pub.track) bindTrack(pub.track);
                });
            });
            clearRefresh();
            clearRefresh = scheduleTokenRefresh(issued.expiresIn, () => {
                if (cancelled) return;
                void join().catch((err: unknown) => {
                    if (cancelled) return;
                    fail(err);
                });
            });
            stallRetries = 0;
        }

        (async () => {
            try {
                socket = await connectLiveSocket(false);
                if (cancelled) {
                    socket.disconnect();
                    return;
                }
            onSocketRef.current?.(socket);
            const joinView = () => {
                socket?.emit("live:viewer", { showId });
            };
            socket.on("connect", joinView);
            socket.on("live:ended", () => {
                stall();
                onEndedRef.current?.();
            });
            if (socket.connected) joinView();
            joinTimer = window.setInterval(joinView, 8000);
            await join();
            } catch (err: unknown) {
                if (!cancelled) fail(err);
            }
        })();

        return () => {
            cancelled = true;
            clearRefresh();
            if (stallRetry) window.clearTimeout(stallRetry);
            if (joinTimer) window.clearInterval(joinTimer);
            void disconnectLivekitRoom(room);
            socket?.disconnect();
            onSocketRef.current?.(null);
        };
    }, [showId, videoRef]);

    function tapToPlay() {
        const video = videoRef.current;
        if (!video) return;
        video.muted = false;
        void video
            .play()
            .then(() => setNeedsTap(false))
            .catch(() => undefined);
    }

    if (!needsTap) return null;

    return (
        <div className="absolute inset-x-0 top-[42%] z-40 flex justify-center px-4">
            <button
                type="button"
                className="rounded-full border border-white/20 bg-white/12 px-4 py-2 text-sm font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl"
                onClick={tapToPlay}
            >
                Hang bekapcsolása
            </button>
        </div>
    );
}
