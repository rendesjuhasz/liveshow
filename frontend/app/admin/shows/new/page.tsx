"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/api/http";
import { SHOW_STATUSES, showStatusLabel } from "@/lib/show-status";
import VideoCategorySelect from "@/components/VideoCategorySelect";

export default function NewShowPage() {
    const { user, ready } = useAuth();
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [streamUrl, setStreamUrl] = useState("");
    const [streamId, setStreamId] = useState("");
    const [error, setError] = useState("");
    const [status, setStatus] = useState("draft");
    const [videoCategory, setVideoCategory] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        try {
            await apiFetch("/admin/shows", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    date,
                    startTime: date,
                    streamUrl,
                    streamId,
                    status,
                    videoCategory,
                }),
            });
            router.push("/admin/shows");
        } catch (err: any) {
            setError(err.message || "Nem sikerült létrehozni a műsort.");
        }
    }

    if (!ready) {
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
                <h1 className="text-3xl font-bold mb-6">Új műsor létrehozása</h1>
                <p className="mb-6 text-sm text-gray-400">
                    Az élő adás és az archívum megtekintése ingyenes. Jegyárat itt nem kell megadni.
                </p>

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

                    {error && <p className="text-red-400">{error}</p>}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded-lg font-semibold"
                    >
                        Műsor létrehozása
                    </button>
                </form>
            </div>
        </div>
    );
}
