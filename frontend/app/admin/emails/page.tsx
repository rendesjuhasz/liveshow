"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { useT } from "@/lib/i18n/I18nProvider";

const LABELS: Record<string, string> = {
    registration: "Regisztráció",
    ticket_purchased: "Jegyvásárlás",
    live_reminder: "Élő emlékeztető",
    archive_ready: "Archívum elkészült",
    streamer_approved: "Tartalomkészítő jóváhagyva",
    payout_approved: "Kifizetés jóváhagyva",
    ops_alert: "Ops riasztás",
};

export default function AdminEmailsPage() {
    const { formatDateTime } = useT();
    const { user, ready } = useAuth();
    const [rows, setRows] = useState<any[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!ready || !user || !isAdmin(user)) return;
        apiFetch("/admin/emails")
            .then((d) => setRows(Array.isArray(d) ? d : []))
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni a naplót."));
    }, [ready, user]);

    if (!ready) return <p className="p-8 text-white">Betöltés...</p>;
    if (!user || !isAdmin(user)) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    return (
        <div className="min-h-dvh bg-gray-900 text-white p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Email értesítések</h1>
                <p className="text-gray-400 mb-6">
                    Automatikus levelek naplója. SMTP nélkül a kimenő fájlok a backend{" "}
                    <code className="text-yellow-400">mail-outbox</code> mappában vannak, a konzolon
                    is megjelennek. Típusok: regisztráció, jegy, élő emlékeztető (kezdés előtt 60
                    perc), archívum, tartalomkészítő jóváhagyás, kifizetés jóváhagyás.
                </p>
                {error && <p className="text-red-400 mb-4">{error}</p>}
                {rows.length === 0 && <p className="text-gray-400">Még nincs kimenő email.</p>}
                <ul className="space-y-3">
                    {rows.map((r) => (
                        <li key={r.id} className="bg-gray-800 p-4 rounded-xl">
                            <p className="font-semibold">
                                {LABELS[r.type] || r.type} · {r.toEmail}
                            </p>
                            <p className="text-sm text-gray-300">{r.subject}</p>
                            <p className="text-xs text-gray-500 mt-2">
                                {r.status} ·{" "}
                                {r.createdAt ? formatDateTime(r.createdAt) : ""}
                            </p>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
