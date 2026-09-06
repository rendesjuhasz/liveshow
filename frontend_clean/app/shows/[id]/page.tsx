"use client";

import { useEffect, useState } from "react";

export default function ShowDetailsPage({ params }: { params: { id: string } }) {
    const { id } = params;

    const [show, setShow] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadShow() {
            try {
                const res = await fetch(`http://localhost:3200/shows/${id}`);

                if (!res.ok) {
                    setError("Nem sikerült betölteni a műsor részleteit.");
                    setLoading(false);
                    return;
                }

                const data = await res.json();
                setShow(data);
            } catch (err) {
                setError("Hiba történt a betöltés során.");
            } finally {
                setLoading(false);
            }
        }

        loadShow();
    }, [id]);

    if (loading) {
        return <p style={{ padding: 20 }}>Betöltés...</p>;
    }

    if (error) {
        return <p style={{ padding: 20, color: "red" }}>{error}</p>;
    }

    if (!show) {
        return <p style={{ padding: 20 }}>A műsor nem található.</p>;
    }

    return (
        <div style={{ padding: 20 }}>
            <h1>{show.title}</h1>

            <p>{show.description}</p>

            {show.image && (
                <img
                    src={show.image}
                    alt={show.title}
                    style={{ width: "100%", maxWidth: 600, marginTop: 20 }}
                />
            )}

            <p style={{ marginTop: 20 }}>
                <strong>Kezdés:</strong> {show.startTime}
            </p>

            <p>
                <strong>Jegyár:</strong> {show.price} Ft
            </p>
        </div>
    );
}
