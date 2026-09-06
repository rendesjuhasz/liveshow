"use client";

import { isAdmin, useAuth } from "@/context/AuthContext";

export default function AdminPlaceholderPage({
    title,
}: {
    title: string;
}) {
    const { user, ready } = useAuth();

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
                <h1 className="text-3xl font-bold mb-4">{title}</h1>
                <p className="text-gray-400 mb-6">Ez a felület hamarosan elérhető.</p>
                <a href="/admin" className="text-blue-400 hover:text-blue-500">
                    ← Vissza az adminhoz
                </a>
            </div>
        </div>
    );
}
