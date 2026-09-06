"use client";

import { useAuth } from "../../context/AuthContext";

export default function AdminPage() {
    const { user } = useAuth();

    // Ha nincs bejelentkezve
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p>Bejelentkezés szükséges.</p>
            </div>
        );
    }

    // Ha nem admin (később backendből jön majd)
    if (user.email !== "admin@admin.com") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p>Nincs jogosultságod az admin felülethez.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-4xl font-bold mb-8">Admin vezérlőpult</h1>

                {/* GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Műsorok kezelése */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Műsorok kezelése</h2>
                        <p className="text-gray-400 mb-4">
                            Új műsor létrehozása, árak, időpontok, élő link, archívum.
                        </p>
                        <a
                            href="/admin/shows"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    {/* Streamerek */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Streamerek</h2>
                        <p className="text-gray-400 mb-4">
                            Streamerek hozzáadása, törlése, bevételek kezelése.
                        </p>
                        <a
                            href="/admin/streamers"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    {/* Moderátorok */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Moderátorok</h2>
                        <p className="text-gray-400 mb-4">
                            Chat és értékelések moderálása, jogosultságok.
                        </p>
                        <a
                            href="/admin/moderators"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    {/* Jegyek */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Jegyek</h2>
                        <p className="text-gray-400 mb-4">
                            Ajándék jegyek kiosztása, jegykezelés, ellenőrzés.
                        </p>
                        <a
                            href="/admin/tickets"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    {/* Kifizetések */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Kifizetések</h2>
                        <p className="text-gray-400 mb-4">
                            Streamerek bevételei, jóváhagyások, státuszok.
                        </p>
                        <a
                            href="/admin/payments"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    {/* Statisztikák */}
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Statisztikák</h2>
                        <p className="text-gray-400 mb-4">
                            Jegyeladások, nézőszámok, bevételek, platform teljesítmény.
                        </p>
                        <a
                            href="/admin/stats"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                </div>
            </div>
        </div>
    );
}
