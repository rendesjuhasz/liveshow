"use client";

import { useEffect, useState } from "react";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/api/http";
import { SHOW_STATUSES, showStatusClass, showStatusLabel } from "@/lib/show-status";
import { useT } from "@/lib/i18n/I18nProvider";

type Show = {
    id: string;
    title: string;
    startTime?: string;
    streamId?: string | null;
    status?: string;
    live?: boolean;
    videoCategoryLabel?: string;
};

export default function AdminShowsPage() {
    const { formatDateTime } = useT();
    const { user, ready } = useAuth();
    const [shows, setShows] = useState<Show[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!ready) return;
        if (!isAdmin(user)) {
            setLoading(false);
            return;
        }

        async function loadShows() {
            try {
                const data = await apiFetch("/admin/shows");
                setShows(Array.isArray(data) ? data : []);
            } catch (err: any) {
                setError(err.message || "Nem sikerült betölteni a műsorokat.");
            } finally {
                setLoading(false);
            }
        }

        loadShows();
    }, [ready, user]);

    async function deleteShow(showId: string) {
        try {
            await apiFetch(`/admin/shows/${showId}`, { method: "DELETE" });
            setShows((prev) => prev.filter((s) => s.id !== showId));
        } catch (err: any) {
            setError(err.message || "Nem sikerült törölni a műsort.");
        }
    }

    if (!ready || loading) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-900 text-white">
                <p>Betöltés...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-900 text-white">
                <p>Bejelentkezés szükséges.</p>
            </div>
        );
    }

    if (!isAdmin(user)) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-900 text-white">
                <p>Nincs jogosultságod a műsorok kezeléséhez.</p>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold mb-2">Műsorok kezelése</h1>
                <p className="text-gray-400 mb-8 text-sm">
                    Az „Aktív” státusz azt jelenti, hogy a műsor jóvá van hagyva a katalógusban.
                    Az élő adás ettől független: leállítás után „nincs adásban”, de maradhat Aktív.
                </p>

                <a
                    href="/admin/shows/new"
                    className="inline-block mb-6 bg-blue-600 hover:bg-blue-700 p-3 rounded-lg font-semibold"
                >
                    + Új műsor létrehozása
                </a>

                {error && <p className="text-red-400 mb-4">{error}</p>}

                {shows.length === 0 && (
                    <p className="text-gray-400">Még nincs műsor.</p>
                )}

                <div className="space-y-4">
                    {shows.map((show) => (
                        <div
                            key={show.id}
                            className="bg-gray-800 p-6 rounded-xl shadow-lg flex justify-between items-center"
                        >
                            <div>
                                <h2 className="text-2xl font-semibold">{show.title}</h2>
                                <p className={`text-sm font-semibold ${showStatusClass(show.status)}`}>
                                    {showStatusLabel(show.status)}
                                    {show.live ? " · élő adás" : " · nincs adásban"}
                                    {show.videoCategoryLabel ? ` · ${show.videoCategoryLabel}` : ""}
                                </p>
                                <p className="text-gray-400">
                                    {show.startTime
                                        ? formatDateTime(show.startTime)
                                        : "Nincs dátum"}
                                </p>
                                <p className="text-sm text-gray-500">Nézés: ingyenes (élő és archív)</p>
                                {show.streamId && (
                                    <p className="text-gray-400">streamId: {show.streamId}</p>
                                )}
                                <label className="block mt-3 text-sm text-gray-300">
                                    Státusz
                                    <select
                                        className="mt-1 p-2 rounded text-black w-full max-w-xs"
                                        value={show.status || "draft"}
                                        onChange={async (e) => {
                                            try {
                                                const updated = await apiFetch(`/admin/shows/${show.id}/status`, {
                                                    method: "PATCH",
                                                    body: JSON.stringify({ status: e.target.value }),
                                                });
                                                setShows((prev) =>
                                                    prev.map((s) => (s.id === show.id ? { ...s, status: updated.status } : s)),
                                                );
                                            } catch (err: any) {
                                                setError(err.message || "A státusz mentése nem sikerült.");
                                            }
                                        }}
                                    >
                                        {SHOW_STATUSES.map((status) => (
                                            <option key={status} value={status}>
                                                {status} — {showStatusLabel(status)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="flex gap-3">
                                <a
                                    href={`/admin/shows/${show.id}`}
                                    className="bg-green-600 hover:bg-green-700 p-2 rounded-lg"
                                >
                                    Szerkesztés
                                </a>

                                <button
                                    onClick={() => deleteShow(show.id)}
                                    className="bg-red-600 hover:bg-red-700 p-2 rounded-lg"
                                >
                                    Törlés
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
