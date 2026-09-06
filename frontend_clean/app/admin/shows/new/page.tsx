"use client";

import { useState } from "react";
import { useAuth } from "../../../../context/AuthContext";

export default function NewShowPage() {
    const { user } = useAuth();

    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [price, setPrice] = useState("");

    if (!user || user.email !== "admin@admin.com") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p>Nincs jogosultság.</p>
            </div>
        );
    }

    function handleSubmit(e: any) {
        e.preventDefault();

        console.log("Új műsor:", { title, date, price });

        alert("Műsor létrehozva (később backendre küldjük)");
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg">

                <h1 className="text-3xl font-bold mb-6">Új műsor létrehozása</h1>

                <form onSubmit={handleSubmit} className="space-y-4">

                    <input
                        type="text"
                        placeholder="Műsor címe"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-3 rounded bg-gray-700 text-white"
                        required
                    />

                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full p-3 rounded bg-gray-700 text-white"
                        required
                    />

                    <input
                        type="number"
                        placeholder="Jegyár (Ft)"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full p-3 rounded bg-gray-700 text-white"
                        required
                    />

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
