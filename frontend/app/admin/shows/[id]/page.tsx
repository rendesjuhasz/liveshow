"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/api/http";
import { SHOW_STATUSES, showStatusLabel } from "@/lib/show-status";
import { LOCALES } from "@/lib/i18n/messages";
import VideoCategorySelect from "@/components/VideoCategorySelect";

export default function EditShowPage() {
    const { user, ready } = useAuth();
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [streamUrl, setStreamUrl] = useState("");
    const [streamId, setStreamId] = useState("");
    const [rtpPort, setRtpPort] = useState("5004");
    const [status, setStatus] = useState("draft");
    const [videoCategory, setVideoCategory] = useState("");
    const [commissionPercent, setCommissionPercent] = useState("");
    const [error, setError] = useState("");
    const [ingestMessage, setIngestMessage] = useState("");
    const [ingestLoading, setIngestLoading] = useState(false);

    useEffect(() => {
        if (!ready) return;
        if (!isAdmin(user) || !id) {
            setLoading(false);
            return;
        }

        async function loadShow() {
            try {
                const data = await apiFetch(`/admin/shows/${id}`);
                setTitle(data.title || "");
                setDate(
                    data.startTime
                        ? new Date(data.startTime).toISOString().slice(0, 10)
                        : ""
                );
                setStreamUrl(data.streamUrl || "");
                setStreamId(data.streamId || "");
                setStatus(data.status || "draft");
                setVideoCategory(data.videoCategory || "");
                setCommissionPercent(
                    data.commissionPercent == null ? "" : String(data.commissionPercent),
                );
            } catch (err: any) {
                setError(err.message || "Nem sikerült betölteni a műsort.");
            } finally {
                setLoading(false);
            }
        }

        loadShow();
    }, [id, ready, user]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        try {
            await apiFetch(`/admin/shows/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    title,
                    date,
                    startTime: date,
                    streamUrl,
                    streamId,
                    status,
                    videoCategory,
                    commissionPercent: commissionPercent === "" ? null : Number(commissionPercent),
                }),
            });
            router.push("/admin/shows");
        } catch (err: any) {
            setError(err.message || "Nem sikerült frissíteni a műsort.");
        }
    }

    async function startIngest() {
        setError("");
        setIngestMessage("");

        if (!streamId.trim()) {
            setError("Előbb add meg a Stream ID-t.");
            return;
        }

        setIngestLoading(true);
        try {
            const data = await apiFetch("/ingest/start", {
                method: "POST",
                body: JSON.stringify({
                    streamId: streamId.trim(),
                    rtpPort: Number(rtpPort),
                }),
            });
            if (data.streamId) {
                setStreamId(data.streamId);
            }
            setIngestMessage(
                `Ingest elindult. streamId: ${data.streamId}. HLS: ${data.hls} (UDP ${data.rtpPort})`
            );
        } catch (err: any) {
            setError(err.message || "Nem sikerült elindítani az ingestet.");
        } finally {
            setIngestLoading(false);
        }
    }

    if (!ready || loading) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-900 text-white">
                <p>Betöltés...</p>
            </div>
        );
    }

    if (!user || !isAdmin(user)) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-900 text-white">
                <p>Nincs jogosultság.</p>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg">
                <h1 className="text-3xl font-bold mb-6">Műsor szerkesztése</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Műsor címe"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-3 rounded bg-gray-700 text-white"
                        required
                    />

                    <label className="block text-sm text-gray-300">
                        Videókategória
                        <div className="mt-1">
                            <VideoCategorySelect value={videoCategory} onChange={setVideoCategory} />
                        </div>
                    </label>

                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full p-3 rounded bg-gray-700 text-white"
                    />

                    <label className="block text-sm text-gray-300">
                        Státusz
                        <select
                            className="w-full mt-1 p-3 rounded bg-gray-700 text-white"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            {SHOW_STATUSES.map((value) => (
                                <option key={value} value={value}>
                                    {value} — {showStatusLabel(value)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block text-sm text-gray-300">
                        Platform részesedés ennél a műsornál (%) — üres = globális beállítás
                        <input
                            className="w-full mt-1 p-3 rounded bg-gray-700 text-white"
                            type="number"
                            min={0}
                            max={90}
                            placeholder="pl. 40"
                            value={commissionPercent}
                            onChange={(e) => setCommissionPercent(e.target.value)}
                        />
                    </label>

                    <input
                        type="text"
                        placeholder="Stream ID (pl. test123)"
                        value={streamId}
                        onChange={(e) => setStreamId(e.target.value)}
                        className="w-full p-3 rounded bg-gray-700 text-white"
                    />

                    <input
                        type="text"
                        placeholder="Stream URL (HLS, pl. https://.../index.m3u8)"
                        value={streamUrl}
                        onChange={(e) => setStreamUrl(e.target.value)}
                        className="w-full p-3 rounded bg-gray-700 text-white"
                    />

                    <input
                        type="number"
                        placeholder="RTP port (pl. 5004)"
                        value={rtpPort}
                        onChange={(e) => setRtpPort(e.target.value)}
                        className="w-full p-3 rounded bg-gray-700 text-white"
                        min={1024}
                        max={65535}
                    />

                    {error && <p className="text-red-400">{error}</p>}
                    {ingestMessage && <p className="text-green-400">{ingestMessage}</p>}

                    <ShowTranslations showId={String(id)} />

                    <button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-700 p-3 rounded-lg font-semibold"
                    >
                        Műsor frissítése
                    </button>
                </form>

                <button
                    type="button"
                    onClick={startIngest}
                    disabled={ingestLoading}
                    className="w-full mt-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 p-3 rounded-lg font-semibold"
                >
                    {ingestLoading ? "Ingest indítása..." : "Ingest indítása (POST /ingest/start)"}
                </button>

                <a
                    href={`/admin/shows/${id}/archive`}
                    className="block w-full mt-4 bg-gray-700 hover:bg-gray-600 p-3 rounded-lg font-semibold text-center"
                >
                    Archívum (FFmpeg)
                </a>

                <a
                    href="/admin/shows"
                    className="block text-center mt-6 text-blue-400 hover:text-blue-500"
                >
                    ← Vissza a műsorokhoz
                </a>
            </div>
        </div>
    );
}

function ShowTranslations({ showId }: { showId: string }) {
    const [locale, setLocale] = useState("en");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tracks, setTracks] = useState<any[]>([]);
    const [track, setTrack] = useState({ kind: "subtitle", locale: "en", label: "", url: "", isDefault: false });
    const [msg, setMsg] = useState("");

    function load() {
        apiFetch(`/admin/i18n/content?entityType=show&entityId=${showId}`).then((rows) => {
            const list = Array.isArray(rows) ? rows : [];
            setTitle(list.find((r: any) => r.locale === locale && r.field === "title")?.value || "");
            setDescription(list.find((r: any) => r.locale === locale && r.field === "description")?.value || "");
        }).catch(() => undefined);
        apiFetch(`/admin/i18n/tracks/${showId}`).then((d) => setTracks(Array.isArray(d) ? d : [])).catch(() => setTracks([]));
    }

    useEffect(() => {
        if (showId) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showId, locale]);

    return (
        <div className="rounded-xl border border-white/10 p-4">
            <h3 className="mb-3 font-semibold">Többnyelvű cím / leírás és sávok</h3>
            <select className="mb-3 w-full rounded bg-gray-700 p-2" value={locale} onChange={(e) => setLocale(e.target.value)}>
                {LOCALES.filter((c) => c !== "hu").map((c) => (
                    <option key={c} value={c}>{c}</option>
                ))}
            </select>
            <input className="mb-2 w-full rounded bg-gray-700 p-2" placeholder="Cím ezen a nyelven" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="mb-2 w-full rounded bg-gray-700 p-2" placeholder="Leírás ezen a nyelven" value={description} onChange={(e) => setDescription(e.target.value)} />
            <button
                type="button"
                className="mb-4 w-full rounded bg-blue-600 p-2"
                onClick={async () => {
                    await apiFetch("/admin/i18n/content", { method: "POST", body: JSON.stringify({ entityType: "show", entityId: showId, field: "title", locale, value: title }) });
                    await apiFetch("/admin/i18n/content", { method: "POST", body: JSON.stringify({ entityType: "show", entityId: showId, field: "description", locale, value: description }) });
                    setMsg("Fordítás mentve.");
                }}
            >
                Cím és leírás mentése
            </button>
            <p className="mb-2 text-sm text-gray-400">Felirat (VTT) / extra hangsáv URL</p>
            <ul className="mb-2 text-xs text-gray-300">
                {tracks.map((tr) => (
                    <li key={tr.id}>{tr.kind} · {tr.locale} · {tr.label}</li>
                ))}
            </ul>
            <div className="grid gap-2">
                <select className="rounded bg-gray-700 p-2" value={track.kind} onChange={(e) => setTrack({ ...track, kind: e.target.value })}>
                    <option value="subtitle">felirat</option>
                    <option value="audio">hangsáv</option>
                </select>
                <input className="rounded bg-gray-700 p-2" placeholder="nyelv (en)" value={track.locale} onChange={(e) => setTrack({ ...track, locale: e.target.value })} />
                <input className="rounded bg-gray-700 p-2" placeholder="címke" value={track.label} onChange={(e) => setTrack({ ...track, label: e.target.value })} />
                <input className="rounded bg-gray-700 p-2" placeholder="https://...vtt" value={track.url} onChange={(e) => setTrack({ ...track, url: e.target.value })} />
                <button
                    type="button"
                    className="rounded bg-purple-600 p-2"
                    onClick={async () => {
                        await apiFetch(`/admin/i18n/tracks/${showId}`, { method: "POST", body: JSON.stringify(track) });
                        setMsg("Sáv mentve.");
                        load();
                    }}
                >
                    Sáv hozzáadása
                </button>
            </div>
            {msg && <p className="mt-2 text-green-400">{msg}</p>}
        </div>
    );
}
