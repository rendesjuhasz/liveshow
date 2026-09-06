"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
    buildHlsPlaylistUrl,
    buildSignedHlsUrl,
    interpolateStreamId,
    isPlaceholderStreamId,
    withStreamToken,
} from "@/lib/getStreamToken";
import { apiFetch } from "@/api/http";
import { useT } from "@/lib/i18n/I18nProvider";

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
};

export default function Player({ streamId, streamUrl, showId, purpose = "live" }: PlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const { t, locale } = useT();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [tracks, setTracks] = useState<MediaTrack[]>([]);
    const [subLocale, setSubLocale] = useState("off");
    const [audioIndex, setAudioIndex] = useState(0);
    const [hlsAudio, setHlsAudio] = useState<{ name: string; lang?: string }[]>([]);

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

        if (isPlaceholderStreamId(streamId)) {
            setError("Ehhez a műsorhoz nincs stream ID. Add meg adminban.");
            setLoading(false);
            return;
        }

        let hls: Hls | null = null;
        let cancelled = false;

        async function start() {
            const playlistUrl =
                streamUrl && !isPlaceholderStreamId(streamUrl)
                    ? interpolateStreamId(streamUrl, streamId)
                    : buildHlsPlaylistUrl(streamId);

            let signed;
            try {
                signed = await buildSignedHlsUrl(streamId, playlistUrl, showId, purpose);
            } catch (err: any) {
                setError(err.message || "Nem sikerült a HLS URL-t összeállítani.");
                setLoading(false);
                return;
            }

            if (cancelled || !video) return;

            if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = signed.url;
                setLoading(false);
            } else if (Hls.isSupported()) {
                hls = new Hls({
                    xhrSetup(xhr, url) {
                        xhr.open(
                            "GET",
                            withStreamToken(url, signed.token, signed.expiresAt, signed.userId),
                            true,
                        );
                    },
                });
                hlsRef.current = hls;
                hls.loadSource(signed.url);
                hls.attachMedia(video);
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
            if (hls) hls.destroy();
            hlsRef.current = null;
            video.removeAttribute("src");
            video.load();
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
                    body: JSON.stringify({ showId, streamId }),
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

    return (
        <div>
            {loading && <p>{t("common.loading")}</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}
            <video
                ref={videoRef}
                controls
                autoPlay
                className="w-full aspect-video bg-black rounded-xl"
                crossOrigin="anonymous"
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
            {(subs.length > 0 || hlsAudio.length > 1 || extras.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
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
