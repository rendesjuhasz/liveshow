"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { getCsrfToken } from "@/api/auth-storage";
import { useAdminGate } from "@/lib/useAdminGate";
import { useT } from "@/lib/i18n/I18nProvider";

export default function AdminPrivateBackupsPage() {
    const { formatDateTime } = useT();
    const gate = useAdminGate();
    const [rows, setRows] = useState<any[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/admin/private-backups")
            .then((d) => setRows(Array.isArray(d) ? d : []))
            .catch((err: any) => setError(err.message || "Nem tölthető be."));
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    async function download(id: string) {
        try {
            const csrf = getCsrfToken();
            const res = await fetch(`/api/admin/private-backups/${id}/file`, {
                credentials: "include",
                headers: {
                    ...(csrf ? { "X-CSRF-Token": csrf } : {}),
                },
            });
            if (!res.ok) throw new Error("A letöltés sikertelen.");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `private-backup-${id}.mp4`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.message || "A letöltés sikertelen.");
        }
    }

    return (
        <div className="min-h-dvh bg-gray-900 p-4 text-white md:p-8">
            <div className="mx-auto max-w-3xl">
                <a href="/admin" className="text-sm text-yellow-300 underline">
                    ← Vissza az adminhoz
                </a>
                <h1 className="mt-4 mb-2 text-3xl font-bold">Privát stream mentések</h1>
                <p className="mb-6 text-gray-400">
                    30 napig őrzött, nem nyilvános biztonsági mentések vita vagy károsító esemény
                    esetén. Ezek nem kerülnek ki a nézői oldalra.
                </p>
                {error && <p className="mb-4 text-red-400">{error}</p>}
                {!rows.length && <p className="text-gray-400">Nincs mentés.</p>}
                <ul className="space-y-3">
                    {rows.map((row) => (
                        <li key={row.id} className="rounded-xl bg-gray-800 p-4">
                            <p className="font-semibold">{row.topic}</p>
                            <p className="text-sm text-gray-400">
                                Lejár: {formatDateTime(row.expiresAt)}
                            </p>
                            <button
                                type="button"
                                className="mt-2 text-yellow-300 underline"
                                onClick={() => download(row.id)}
                            >
                                Letöltés
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
