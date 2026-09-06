"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/api/http";
import { buildSignedArchiveUrl } from "@/lib/getStreamToken";

type ArchiveInfo = {
    exists: boolean;
    streamId?: string;
    publicPath?: string;
    size: number;
    createdAt: string | null;
    title?: string;
};

export default function ArchiveAdminPage() {
    const { user, ready } = useAuth();
    const { id } = useParams<{ id: string }>();
    const [archive, setArchive] = useState<ArchiveInfo | null>(null);
    const [videoSrc, setVideoSrc] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function applyArchive(data: ArchiveInfo) {
        setArchive(data);
        const streamId = data?.streamId?.trim();
        if (!data?.exists || !streamId) {
            setVideoSrc("");
            return;
        }

        try {
            const signed = await buildSignedArchiveUrl(streamId, String(id));
            setVideoSrc(signed.url);
        } catch (err: any) {
            setVideoSrc("");
            setError(err.message || "Nem sikerült az archívum lejátszási URL-jét összeállítani.");
        }
    }

    async function loadArchive() {
        const data = await apiFetch(`/admin/shows/${id}/archive`);
        await applyArchive(data);
    }

    useEffect(() => {
        if (!ready) return;
        if (!isAdmin(user) || !id) {
            setLoading(false);
            return;
        }

        loadArchive()
            .catch((err: any) => {
                setError(err.message || "Nem sikerült betölteni az archívumot.");
                setArchive({ exists: false, size: 0, createdAt: null });
            })
            .finally(() => setLoading(false));
    }, [id, ready, user]);

    async function generateArchive() {
        setError("");
        setBusy(true);
        try {
            const data = await apiFetch(`/admin/shows/${id}/archive/regenerate`, {
                method: "POST",
            });
            await applyArchive(data);
        } catch (err: any) {
            setError(err.message || "Az FFmpeg archívumgenerálás sikertelen.");
        } finally {
            setBusy(false);
        }
    }

    async function deleteArchive() {
        setError("");
        setBusy(true);
        try {
            const data = await apiFetch(`/admin/shows/${id}/archive`, {
                method: "DELETE",
            });
            setArchive(data);
            setVideoSrc("");
        } catch (err: any) {
            setError(err.message || "Nem sikerült törölni az archívumot.");
        } finally {
            setBusy(false);
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
            <div className="max-w-3xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg">
                <h1 className="text-3xl font-bold mb-6">
                    Archívum {archive?.title ? `— ${archive.title}` : ""}
                </h1>

                {error && <p className="text-red-400 mb-4">{error}</p>}

                {!archive?.exists ? (
                    <p className="text-gray-400 mb-6">
                        Még nincs archívum. FFmpeg a HLS playlistből vagy a recording.mp4-ből
                        készíti el.
                    </p>
                ) : (
                    <>
                        <p className="mb-2">
                            <span className="font-bold">Stream ID:</span> {archive.streamId}
                        </p>
                        <p className="mb-2">
                            <span className="font-bold">Fájl:</span>{" "}
                            {videoSrc ? (
                                <a
                                    href={videoSrc}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-400 hover:text-blue-300 underline break-all"
                                >
                                    {archive.streamId
                                        ? `/output/${archive.streamId}/archive.mp4`
                                        : archive.publicPath}
                                </a>
                            ) : archive.streamId ? (
                                `/output/${archive.streamId}/archive.mp4`
                            ) : (
                                archive.publicPath
                            )}
                        </p>
                        <p className="mb-2">
                            <span className="font-bold">Méret:</span>{" "}
                            {(archive.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                        <p className="mb-4">
                            <span className="font-bold">Létrehozva:</span>{" "}
                            {archive.createdAt
                                ? new Date(archive.createdAt).toLocaleString("hu-HU")
                                : "-"}
                        </p>

                        {videoSrc ? (
                            <div className="flex flex-wrap gap-3 mb-4">
                                <a
                                    href={videoSrc}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold"
                                >
                                    Megnyitás új lapon
                                </a>
                                <a
                                    href={videoSrc}
                                    download={`${archive.streamId || "archive"}.mp4`}
                                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold"
                                >
                                    Letöltés
                                </a>
                            </div>
                        ) : (
                            <p className="text-gray-400 mb-4">
                                A lejátszási URL összeállítása folyamatban, vagy a stream token
                                hiányzik.
                            </p>
                        )}

                        <video
                            key={videoSrc || "empty"}
                            controls
                            playsInline
                            preload="metadata"
                            src={videoSrc || undefined}
                            className="w-full aspect-video bg-black rounded-lg mb-6"
                        >
                            A böngésző nem támogatja a videólejátszást.
                        </video>
                    </>
                )}

                <div className="flex gap-4">
                    <button
                        onClick={deleteArchive}
                        disabled={busy || !archive?.exists}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 p-3 rounded-lg font-semibold"
                    >
                        Archívum törlése
                    </button>

                    <button
                        onClick={generateArchive}
                        disabled={busy}
                        className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 p-3 rounded-lg font-semibold"
                    >
                        {busy ? "FFmpeg fut..." : "Archívum generálása"}
                    </button>
                </div>

                <a
                    href={`/admin/shows/${id}`}
                    className="block text-center mt-6 text-blue-400 hover:text-blue-500"
                >
                    ← Vissza a műsorhoz
                </a>
            </div>
        </div>
    );
}
