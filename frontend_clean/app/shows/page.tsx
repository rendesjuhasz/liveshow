"use client";

import { useEffect, useState } from "react";

export default function ShowsPage() {
    const [shows, setShows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadShows() {
            try {
                const res = await fetch("http://localhost:3200/shows");

                if (!res.ok) {
                    setError("Nem sikerült betölteni a műsorokat.");
                    setLoading(false);
                    return;
                }

                const data = await res.json();
                setShows(data);
            } catch (err) {
                setError("Hiba történt a betöltés során.");
            } finally {
                setLoading(false);
            }
        }

        loadShows();
    }, []);

    if (loading) {
        return <p style={{ padding: 20 }}>Betöltés...</p>;
    }

    if (error) {
        return <p style={{ padding: 20, color: "red" }}>{error}</p>;
    }

    return (
        <div style={{ padding: 20 }}>
            <h1>Műsorok</h1>

            {shows.length === 0 && <p>Nincs elérhető műsor.</p>}

            <ul>
                {shows.map((show) => (
                    <li key={show.id} style={{ marginBottom: 10 }}>
                        <strong>{show.title}</strong>
                        <br />
                        {show.description}
                    </li>
                ))}
            </ul>
        </div>
    );
}
