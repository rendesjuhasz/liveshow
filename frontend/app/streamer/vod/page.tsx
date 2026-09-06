"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUpload } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import VideoCategorySelect from "@/components/VideoCategorySelect";

const VIDEO_ACCEPT = ".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm";

export default function StreamerVodUploadPage() {
    const gate = useStreamerGate();
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [videoCategory, setVideoCategory] = useState("");
    const [cover, setCover] = useState<File | null>(null);
    const [video, setVideo] = useState<File | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        if (!cover) {
            setError("A borítókép kötelező.");
            return;
        }
        if (!video) {
            setError("A videófájl kötelező.");
            return;
        }
        const ext = video.name.split(".").pop()?.toLowerCase() || "";
        if (!["mp4", "mov", "webm", "m4v"].includes(ext)) {
            setError("A videó MP4, MOV vagy WEBM legyen.");
            return;
        }
        setBusy(true);
        try {
            const form = new FormData();
            form.append("title", title);
            form.append("description", description);
            form.append("videoCategory", videoCategory);
            form.append("cover", cover);
            form.append("video", video);
            await apiUpload("/streamer/vod", form);
            router.push("/streamer/shows");
        } catch (err: any) {
            setError(err.message || "A feltöltés nem sikerült.");
        } finally {
            setBusy(false);
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A streamer felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title="Videó feltöltése">
            <form onSubmit={submit} className="grid max-w-xl gap-4 rounded-2xl bg-neutral-900 p-6">
                <p className="text-sm text-neutral-400">
                    A feltöltött videó azonnal megjelenik a nyilvános archívumban, a profilodon,
                    és kategória szerint szűrhető, kereshető. Nem élő esemény: nincs kezdési
                    időpont, a nézők visszanézésként érik el.
                </p>
                <label className="grid gap-1">
                    Cím
                    <input
                        className="rounded p-3 text-black"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                </label>
                <label className="grid gap-1">
                    Leírás
                    <textarea
                        className="min-h-24 rounded p-3 text-black"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        minLength={4}
                    />
                </label>
                <label className="grid gap-1">
                    Kategória
                    <VideoCategorySelect value={videoCategory} onChange={setVideoCategory} />
                </label>
                <label className="grid gap-1">
                    Borítókép
                    <input
                        className="rounded bg-neutral-800 p-3 text-sm"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        required
                        onChange={(e) => setCover(e.target.files?.[0] || null)}
                    />
                </label>
                <label className="grid gap-1">
                    Videófájl (MP4, MOV, WEBM)
                    <input
                        className="rounded bg-neutral-800 p-3 text-sm"
                        type="file"
                        accept={VIDEO_ACCEPT}
                        required
                        onChange={(e) => setVideo(e.target.files?.[0] || null)}
                    />
                    {video && (
                        <span className="text-xs text-neutral-500">
                            {video.name} · {(video.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                    )}
                </label>
                {error && <p className="text-red-400">{error}</p>}
                <button
                    disabled={busy}
                    className="rounded-xl bg-yellow-500 p-3 font-bold text-black disabled:opacity-50"
                >
                    {busy ? "Feltöltés és feldolgozás..." : "Videó feltöltése"}
                </button>
            </form>
        </StreamerShell>
    );
}
