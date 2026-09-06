"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";

type Show = {
    id: string;
    title: string;
    date: string;
    price: number;
};

export default function AdminShowsPage() {
    const { user } = useAuth();
    const [shows, setShows] = useState<Show[]>([]);
    const [loading, setLoading] = useState(true);

    // Jogosultság ellenőrzés
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p>Bejelentkezés szükséges.</p>
            </div>
        );
    }

    if (user.email !== "admin@admin.com") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p>Nincs jogosultságod a műsorok kezeléséhez.</p>
            </div>
        );
    }

    // Műsorok betöltése (később backendből)
    useEffect(() => {
        async function loadShows() {
            // később backend fetch:
            // const res = await fetch("http://localhost:3000/admin/shows");
            // const data = await res.json();
            // setShows(data);

            // egyelőre demo adatok:
            setShows([
                { id: "1", title: "Élő Show – Budapest", date: "2026-09-12", price: 3500 },
                { id: "2", title: "Koncert – Debrecen", date: "2026-10-01", price: 4200 },
            ]);

            setLoading(false);
        }

        loadShows();
    }, []);

    // Törlés funkció
    async function deleteShow(showId: string) {
        // később backend DELETE:
        // await fetch(`http://localhost:3000/admin/shows/${showId}`, { method: "DELETE" });

        // DEMO: törlés a listából
        setShows((prev) => prev.filter((s) => s.id !== showId));
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p>Betöltés...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-4xl mx-auto">

                <h1 className="text-4xl font-bold mb-8">Műsorok kezelése</h1>

                {/* Új műsor létrehozása */}
                <a
                    href="/admin/shows/new"
                    className="inline-block mb-6 bg-blue-600 hover:bg-blue-700 p-3 rounded-lg font-semibold"
                >
                    + Új műsor létrehozása
                </a>

                {/* Műsor lista */}
                <div className="space-y-4">
                    {shows.map((show) => (
                        <div
                            key={show.id}
                            className="bg-gray-800 p-6 rounded-xl shadow-lg flex justify-between items-center"
                        >
                            <div>
                                <h2 className="text-2xl font-semibold">{show.title}</h2>
                                <p className="text-gray-400">{show.date}</p>
                                <p className="text-gray-400">{show.price} Ft</p>
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
