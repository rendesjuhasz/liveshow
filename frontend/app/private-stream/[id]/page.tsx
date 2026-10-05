"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import Player from "@/app/live/[id]/Player";

export default function PrivateStreamPage() {
    const { id } = useParams<{ id: string }>();
    const { user, ready } = useAuth();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!ready || !user || !id) return;
        apiFetch(`/private-requests/${id}/watch`)
            .then(setData)
            .catch((err: any) => setError(err.message || "A privát stream nem elérhető."));
    }, [ready, user, id]);

    if (!ready) return <p className="p-8 text-white">Betöltés...</p>;
    if (!user) {
        return (
            <p className="p-8 text-white">
                <Link href="/login" className="text-accent">
                    Belépés
                </Link>
            </p>
        );
    }
    if (error) return <p className="p-8 text-red-400">{error}</p>;
    if (!data) return <p className="p-8 text-white">Betöltés...</p>;

    return (
        <div className="mx-auto min-h-dvh max-w-4xl px-4 py-10">
            <h1 className="mb-2 text-2xl font-extrabold">{data.title}</h1>
            <p className="mb-4 text-sm text-zinc-400">
                {data.role === "streamer" ? "Tartalomkészítő nézet" : "Csak a jegyet megvásárló nézőnek."}
            </p>
            <p className="mb-6 rounded-xl border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-400">
                {data.notice}
            </p>
            {data.streamId ? (
                <Player showId={data.showId} streamId={data.streamId} purpose="private" />
            ) : (
                <p className="text-zinc-400">A stream még nem indult el.</p>
            )}
        </div>
    );
}
