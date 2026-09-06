"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../../../context/AuthContext";
import { useParams } from "next/navigation";

type ArchiveInfo = {
    exists: boolean;
    path: string;
    size: number;
    createdAt: string;
};

export default function ArchiveAdminPage() {
    const { user } = useAuth();
    const { id } = useParams();

    const [archive, setArchive] = useState<ArchiveInfo | null>(null);
    const [loading, setLoading] = useState(true);

    if (!user || user.email !== "admin@admin.com") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p>Nincs jogosultság.</p>
            </div>
        );
    }

    useEffect(() => {
        async function loadArchive() {
            // Később backend:
            // const res = await fetch(`http://localhost:3000/admin/shows/${id}/archive`);
            // const data = await res.json();
            // setArchive(data);

            // DEMO: automatikus archívum
            const demoArchive = {
                exists: true,
                path: `/archives/show-${id}.mp4`,
                size: 842_000_000, // 842 MB
                createdAt: "2026-09-12 21:48",
            };

            setArchive(demoArchive);
            setLoading(false);
        }

        loadArchive();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p>Betöltés...</p>
            </div>
        );
    }

    if (!archive?.exists) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-8">
                <div className="max-w-xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg">
                    <h1 className="text-3xl font-bold mb-6">Archívum</h1>
                    <p className="text-gray-400 mb-4">
                        Az archívum még nem készült el. Az élő adás rögzítése folyamatban van.
                    </p>

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

    function deleteArchive() {
        alert("Archívum törölve (később backend DELETE)");
    }

    function regenerateArchive() {
        alert("Archívum újragenerálása elindítva (később backend FFmpeg restart)");
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg">

                <h1 className="text-3xl font-bold mb-6">Archívum</h1>

                <p className="mb-2">
                    <span className="font-bold">Fájl:</span> {archive.path}
                </p>

                <p className="mb-2">
                    <span className="font-bold">Méret:</span> {(archive.size / 1024 / 1024).toFixed(1)} MB
                </p>

                <p className="mb-6">
                    <span className="font-bold">Létrehozva:</span> {archive.createdAt}
                </p>

                {/* Lejátszás */}
                <video
                    controls
                    src={archive.path}
                    className="w-full rounded-lg mb-6"
                />

                {/* Gombok */}
                <div className="flex gap-4">
                    <button
                        onClick={deleteArchive}
                        className="flex-1 bg-red-600 hover:bg-red-700 p-3 rounded-lg font-semibold"
                    >
                        Archívum törlése
                    </button>

                    <button
                        onClick={regenerateArchive}
                        className="flex-1 bg-yellow-600 hover:bg-yellow-700 p-3 rounded-lg font-semibold"
                    >
                        Újragenerálás
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
