"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import Hls from "hls.js";
import {
    buildHlsPlaylistUrl,
    buildSignedHlsUrl,
    getStreamToken,
    interpolateStreamId,
    isPlaceholderStreamId,
} from "@/lib/getStreamToken";
import { apiFetch } from "@/api/http";
import { useT } from "@/lib/i18n/I18nProvider";
import { getViewerKey } from "@/lib/viewer-key";
import LiveWebRtcWatch from "@/components/LiveWebRtcWatch";
import LiveKitWatch from "@/components/LiveKitWatch";
import ViewerReactionBar from "@/components/ViewerReactionBar";
import { fetchLiveVideoConfig, lockLiveVideoBackend, type LiveVideoBackend } from "@/lib/livekit-session";

type MediaTrack = {
    id: string;
    kind: string;
    locale: string;
    label: string;
    url: string;
    isDefault?: boolean;
};

type PlayerProps = {
    streamId: string;
    streamUrl?: string | null;
    showId?: string;
    purpose?: "live" | "private";
    liveControls?: boolean;
    ownShow?: boolean;
    onBroadcastLive?: (live: boolean) => void;
    onBroadcastEnded?: () => void;
};

export default function Player({
    streamId,
    streamUrl,
    showId,
    purpose = "live",
    liveControls = true,
    ownShow = false,
    onBroadcastLive,
    onBroadcastEnded,
}: PlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const { t, locale } = useT();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [tracks, setTracks] = useState<MediaTrack[]>([]);
    const [subLocale, setSubLocale] = useState("off");
    const [audioIndex, setAudioIndex] = useState(0);
    const [hlsAudio, setHlsAudio] = useState<{ name?: string; lang?: string }[]>([]);
    const [webrtcLive, setWebrtcLive] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");
    const [liveBackend, setLiveBackend] = useState<LiveVideoBackend | null>(null);
    const webrtcLiveRef = useRef(false);
    const liveSocketRef = useRef<Socket | null>(null);
    const committedBackendRef = useRef<LiveVideoBackend | null>(null);
    const onBroadcastLiveRef = useRef(onBroadcastLive);
    const onBroadcastEndedRef = useRef(onBroadcastEnded);
    onBroadcastLiveRef.current = onBroadcastLive;
    onBroadcastEndedRef.current = onBroadcastEnded;

    useEffect(() => {
        onBroadcastLiveRef.current?.(webrtcLive);
    }, [webrtcLive]);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        el.playsInline = true;
        el.setAttribute("playsinline", "true");
        el.setAttribute("webkit-playsinline", "true");
    }, []);

    useEffect(() => {
        committedBackendRef.current = null;
        setLiveBackend(null);

        if (purpose !== "live" || !showId) {
            committedBackendRef.current = "mesh";
            setLiveBackend("mesh");
            return;
        }

        const id = showId;
        let cancelled = false;
        let timer = 0;
        setLoading(true);
        async function pull() {
            try {
                const cfg = await fetchLiveVideoConfig(id);
                if (cancelled) return;
                if (committedBackendRef.current) return;
                const next = lockLiveVideoBackend(committedBackendRef.current, cfg.backend);
                if (!next) {
                    timer = window.setTimeout(pull, 1500);
                    return;
                }
                if (committedBackendRef.current) return;
                committedBackendRef.current = next;
                setLiveBackend(next);
            } catch {
                if (cancelled || committedBackendRef.current) return;
                timer = window.setTimeout(pull, 2000);
            }
        }
        void pull();
        return () => {
            cancelled = true;
            if (timer) window.clearTimeout(timer);
            committedBackendRef.current = null;
            setLiveBackend(null);
        };
    }, [purpose, showId]);

    useEffect(() => {
        if (!showId) return;
        apiFetch(`/shows/${showId}/tracks`)
            .then((rows) => setTracks(Array.isArray(rows) ? rows : []))
            .catch(() => setTracks([]));
    }, [showId]);

    useEffect(() => {
        const def = tracks.find((tr) => tr.kind === "subtitle" && (tr.isDefault || tr.locale === locale));
        setSubLocale(def ? def.locale : "off");
    }, [tracks, locale]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        for (let i = 0; i < video.textTracks.length; i += 1) {
            video.textTracks[i].mode = video.textTracks[i].language === subLocale ? "showing" : "disabled";
        }
    }, [subLocale, tracks, loading]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const media = video;

        if (isPlaceholderStreamId(streamId)) {
            setError("Ehhez a műsorhoz nincs stream ID. Add meg adminban.");
            setLoading(false);
            return;
        }

        let hls: Hls | null = null;
        let cancelled = false;

        let refreshTimer: number | undefined;
        async function start() {
            setHlsAudio([]);
            setAudioIndex(0);
            if (purpose === "live" && showId) {
                media.removeAttribute("src");
                return;
            }
            const playlistUrl =
                streamUrl && !isPlaceholderStreamId(streamUrl)
                    ? interpolateStreamId(streamUrl, streamId)
                    : buildHlsPlaylistUrl(streamId);

            let signed: Awaited<ReturnType<typeof buildSignedHlsUrl>> | null = null;
            for (let attempt = 0; attempt < 45 && !cancelled && !webrtcLiveRef.current; attempt += 1) {
                try {
                    signed = await buildSignedHlsUrl(streamId, playlistUrl, showId, purpose);
                    const probe = await fetch(signed.url, { credentials: "include", method: "GET" });
                    if (probe.ok) break;
                    signed = null;
                    if (probe.status === 403) {
                        setLoading(false);
                        return;
                    }
                } catch {
                    signed = null;
                }
                await new Promise((r) => window.setTimeout(r, 2000));
            }

            if (cancelled || !media || webrtcLiveRef.current || !signed) {
                if (!webrtcLiveRef.current) setLoading(false);
                return;
            }

            refreshTimer = window.setInterval(() => {
                getStreamToken(streamId, showId, purpose).catch(() => undefined);
            }, 60_000);

            if (media.canPlayType("application/vnd.apple.mpegurl")) {
                media.src = signed.url;
                setLoading(false);
            } else if (Hls.isSupported()) {
                hls = new Hls({
                    xhrSetup(xhr) {
                        xhr.withCredentials = true;
                    },
                });
                hlsRef.current = hls;
                hls.loadSource(signed.url);
                hls.attachMedia(media);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    setLoading(false);
                    const list = hls?.audioTracks || [];
                    setHlsAudio(list.map((a) => ({ name: a.name, lang: a.lang })));
                    const preferred = list.findIndex((a) => a.lang === locale || a.default);
                    if (preferred >= 0 && hls) {
                        hls.audioTrack = preferred;
                        setAudioIndex(preferred);
                    }
                });
                hls.on(Hls.Events.ERROR, (_event, data) => {
                    if (data.fatal) {
                        setError("A stream nem érhető el.");
                        setLoading(false);
                    }
                });
            } else {
                setError("Ez a böngésző nem támogatja a HLS lejátszást.");
                setLoading(false);
            }
        }

        start();

        return () => {
            cancelled = true;
            if (refreshTimer) window.clearInterval(refreshTimer);
            if (hls) hls.destroy();
            hlsRef.current = null;
            if (!webrtcLiveRef.current) {
                media.removeAttribute("src");
                media.load();
            }
        };
    }, [streamId, streamUrl, showId, purpose, locale]);

    useEffect(() => {
        if (purpose !== "live" || !showId) return;
        const video = videoRef.current;
        let cancelled = false;

        async function ping() {
            if (cancelled) return;
            if (video && (video.paused || video.ended)) return;
            try {
                await apiFetch("/views/live", {
                    method: "POST",
                    body: JSON.stringify({
                        showId,
                        streamId,
                        viewerKey: getViewerKey(),
                    }),
                });
            } catch {
                /* a HLS playlist heartbeat a fő forrás */
            }
        }

        ping();
        const t = window.setInterval(ping, 25000);
        return () => {
            cancelled = true;
            window.clearInterval(t);
        };
    }, [purpose, showId, streamId]);

    const subs = tracks.filter((tr) => tr.kind === "subtitle");
    const extras = tracks.filter((tr) => tr.kind === "audio");

    const liveFill = purpose === "live";

    return (
        <div className={liveFill ? "relative h-full" : undefined}>
            {loading && !previewUrl && (
                <p className={liveFill ? "pointer-events-none absolute inset-x-3 top-1/2 z-10 -translate-y-1/2 text-center text-sm text-white/50 drop-shadow" : undefined}>
                    {t("common.loading")}
                </p>
            )}
            {error && (
                <p className={liveFill ? "absolute inset-x-3 top-28 z-20 text-sm font-semibold text-red-300 drop-shadow" : "text-danger"}>
                    {error}
                </p>
            )}
            {purpose === "live" && showId && liveBackend === "livekit" ? (
                <LiveKitWatch
                    showId={showId}
                    videoRef={videoRef}
                    onSocket={(sock) => {
                        liveSocketRef.current = sock;
                    }}
                    onStalled={() => {
                        webrtcLiveRef.current = false;
                        setWebrtcLive(false);
                    }}
                    onReady={() => {
                        webrtcLiveRef.current = true;
                        setWebrtcLive(true);
                        setLoading(false);
                        setError("");
                        hlsRef.current?.destroy();
                        hlsRef.current = null;
                    }}
                    onError={(message) => {
                        setError(message);
                        setLoading(false);
                    }}
                    onEnded={() => onBroadcastEndedRef.current?.()}
                />
            ) : null}
            {purpose === "live" && showId && liveBackend === "mesh" ? (
                <LiveWebRtcWatch
                    showId={showId}
                    videoRef={videoRef}
                    onSocket={(sock) => {
                        liveSocketRef.current = sock;
                    }}
                    onPreview={(url) => {
                        if (!url) return;
                        setPreviewUrl(url);
                        setLoading(false);
                        setError("");
                    }}
                    onStalled={() => {
                        webrtcLiveRef.current = false;
                        setWebrtcLive(false);
                    }}
                    onReady={() => {
                        webrtcLiveRef.current = true;
                        setWebrtcLive(true);
                        setLoading(false);
                        setError("");
                        hlsRef.current?.destroy();
                        hlsRef.current = null;
                    }}
                    onEnded={() => onBroadcastEndedRef.current?.()}
                />
            ) : null}
            <div
                className={
                    liveFill
                        ? "relative h-full w-full overflow-visible bg-black"
                        : "relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
                }
            >
                <video
                    ref={videoRef}
                    controls={!liveFill && webrtcLive}
                    autoPlay
                    playsInline
                    muted
                    className={
                        liveFill
                            ? "pointer-events-none absolute inset-0 z-0 h-full w-full max-w-none bg-black object-cover"
                            : "absolute inset-0 h-full w-full bg-black"
                    }
                >
                    {subs.map((tr) => (
                        <track
                            key={tr.id}
                            kind="subtitles"
                            srcLang={tr.locale}
                            label={tr.label}
                            src={tr.url}
                            default={Boolean(tr.isDefault)}
                        />
                    ))}
                </video>
                {previewUrl && !webrtcLive ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={previewUrl}
                        alt=""
                        className={`pointer-events-none absolute inset-0 z-10 h-full w-full ${liveFill ? "max-w-none object-cover" : "object-contain"}`}
                    />
                ) : null}
                {purpose === "live" && showId ? (
                    <ViewerReactionBar
                        shareKind="live"
                        shareId={showId}
                        enableSupport={Boolean(liveControls || webrtcLive)}
                        ownShow={ownShow}
                        live={Boolean(liveControls || webrtcLive)}
                        onReact={
                            liveControls || webrtcLive
                                ? (emoji) => {
                                      liveSocketRef.current?.emit("live:reaction", {
                                          type: "reaction",
                                          reactionType: "emoji",
                                          value: emoji,
                                          streamId,
                                          showId,
                                      });
                                  }
                                : undefined
                        }
                    />
                ) : null}
            </div>
            {(subs.length > 0 || hlsAudio.length > 1 || extras.length > 0) && (
                <div
                    className={
                        liveFill
                            ? "absolute bottom-3 left-3 z-30 mt-0 flex max-w-[min(70%,20rem)] flex-wrap gap-2 text-xs"
                            : "mt-3 flex flex-wrap gap-3 text-sm"
                    }
                >
                    {subs.length > 0 && (
                        <label className="flex items-center gap-2">
                            {t("player.subtitles")}
                            <select
                                className="rounded-lg border border-white/10 bg-black px-2 py-1"
                                value={subLocale}
                                onChange={(e) => setSubLocale(e.target.value)}
                            >
                                <option value="off">{t("player.subtitlesOff")}</option>
                                {subs.map((tr) => (
                                    <option key={tr.id} value={tr.locale}>
                                        {tr.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    {hlsAudio.length > 1 && (
                        <label className="flex items-center gap-2">
                            {t("player.audio")}
                            <select
                                className="rounded-lg border border-white/10 bg-black px-2 py-1"
                                value={audioIndex}
                                onChange={(e) => {
                                    const next = Number(e.target.value);
                                    setAudioIndex(next);
                                    if (hlsRef.current) hlsRef.current.audioTrack = next;
                                }}
                            >
                                {hlsAudio.map((a, i) => (
                                    <option key={`${a.name}-${i}`} value={i}>
                                        {a.name || a.lang || `${t("player.audio")} ${i + 1}`}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    {extras.map((tr) => (
                        <a key={tr.id} href={tr.url} className="text-accent underline">
                            {t("player.audio")}: {tr.label}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
