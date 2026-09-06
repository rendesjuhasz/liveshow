"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../../context/AuthContext";
import { useParams } from "next/navigation";

type Show = {
    id: string;
    title: string;
    date: string;
    price: number;
    streamUrl?: string;
};

export default function EditShowPage() {
    const { user } = useAuth();
    const { id } = useParams();

    const [show, setShow] = useState<Show | null>(null);
    const [loading, setLoading] = useState(true);

    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [price, setPrice] = useState("");
    const [streamUrl, setStreamUrl] = useState("");

    if (!user || user.email !== "admin@admin.com") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p>Nincs jogosultság.</p>
            </div>
        );
    }

    useEffect(() => {
        async function loadShow() {
            // később backend fetch:
            // const res = await fetch(`http://localhost:3000/admin/shows/${id}`);
            // const data = await res.json();
            // setShow(data);

            // DEMO adat:
            const demoShow = {
                id: id as string,
                title: "Demo műsor címe",
                date: "2026-09-12",
                price: 3500,
                streamUrl: "https://live.example.com/stream123",
            };

            setShow(demoShow);
            setTitle(demoShow.title);
            setDate(demoShow.date);
            setPrice(String(demoShow.price));
            setStreamUrl(demoShow.streamUrl || "");

            setLoading(false);
        }

        loadShow();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <p>Betöltés...</p>
            </div>
        );
    }

    function handleSubmit(e: any) {
        e.preventDefault();

        console.log("Műsor frissítve:", {
            title,
            date,
            price,
            streamUrl,
        });

        alert("Műsor frissítve (később backendre küldjük)");
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
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

                    {/* Stream URL */}
                    <input
                        type="text"
                        placeholder="Élő stream link (HLS / RTMP / WebRTC)"
                        value={streamUrl}
                        onChange={(e) => setStreamUrl(e.target.value)}
                        className="w-full p-3 rounded bg-gray-700 text-white"
                    />

                    <button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-700 p-3 rounded-lg font-semibold"
                    >
                        Műsor frissítése
                    </button>

                </form>

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
