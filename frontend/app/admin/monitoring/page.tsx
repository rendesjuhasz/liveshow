"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";
import { useT } from "@/lib/i18n/I18nProvider";

function formatUptime(sec?: number) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h) return `${h} ó ${m} p`;
    if (m) return `${m} perc`;
    return `${s} mp`;
}

function Status({ value }: { value?: string }) {
    const ok = value === "ok" || value === "skip";
    return (
        <span className={ok ? "text-green-400" : "text-red-400"}>
            {value || "—"}
        </span>
    );
}

export default function AdminMonitoringPage() {
    const { formatDateTime } = useT();
    const gate = useAdminGate();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        const load = () =>
            apiFetch("/admin/ops")
                .then(setData)
                .catch((err: any) => setError(err.message || "A monitoring nem tölthető be."));
        void load();
        const t = setInterval(() => void load(), 15_000);
        return () => clearInterval(t);
    }, [gate.ok]);

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    const health = data?.health || {};
    const streams = data?.streams || {};
    const backup = data?.backup || {};
    const email = data?.email || {};

    return (
        <div className="min-h-dvh bg-gray-900 p-4 text-white md:p-8">
            <div className="mx-auto max-w-5xl">
                <a href="/admin" className="text-sm text-yellow-300 underline">
                    ← Vissza az adminhoz
                </a>
                <h1 className="mt-4 mb-2 text-3xl font-bold">Monitoring</h1>
                <p className="mb-6 text-gray-400">
                    Health, élő streamek, backup, SMTP hibák. Nyilvános probe: GET /health/uptime
                </p>
                {error && <p className="mb-4 text-red-400">{error}</p>}

                <h2 className="text-xl font-semibold mb-3">Health</h2>
                <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Összesített</p>
                        <p className="text-2xl font-bold">
                            <Status value={health.status} />
                        </p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Adatbázis</p>
                        <p className="text-2xl font-bold">
                            <Status value={health.db} />
                        </p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">FFmpeg</p>
                        <p className="text-2xl font-bold">
                            <Status value={health.ffmpeg} />
                        </p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Lemez</p>
                        <p className="text-2xl font-bold">
                            <Status value={health.disk} />
                        </p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">SMTP</p>
                        <p className="text-2xl font-bold">
                            <Status value={health.smtp} />
                        </p>
                    </div>
                </div>

                <h2 className="text-xl font-semibold mb-3">Streamek</h2>
                <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Aktív</p>
                        <p className="text-2xl font-bold">{streams.activeCount ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Sikertelen indítás (24 ó)</p>
                        <p className="text-2xl font-bold">{streams.failedStarts24h ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Ingest hiba (24 ó)</p>
                        <p className="text-2xl font-bold">{streams.ingestFailures24h ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Archívum hiba (24 ó)</p>
                        <p className="text-2xl font-bold">{streams.archiveFailures24h ?? 0}</p>
                    </div>
                </div>
                <ul className="mb-8 space-y-2 text-sm">
                    {(streams.active || []).length === 0 && (
                        <li className="text-gray-400">Most nincs élő ingest.</li>
                    )}
                    {(streams.active || []).map((row: any) => (
                        <li key={row.streamId} className="rounded-xl bg-gray-800 p-3 flex justify-between gap-3">
                            <span>
                                {row.title || row.streamId}
                                {row.ingestProcess ? " · ffmpeg fut" : " · nincs ffmpeg"}
                            </span>
                            <span>{formatUptime(row.uptimeSec)}</span>
                        </li>
                    ))}
                </ul>

                <h2 className="text-xl font-semibold mb-3">Backup</h2>
                <div className="mb-8 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Utolsó sikeres + ellenőrzött</p>
                        <p className="mt-1 font-semibold">
                            {backup.lastSuccessAt
                                ? formatDateTime(backup.lastSuccessAt)
                                : "Még nincs"}
                        </p>
                        <p className="text-sm text-gray-400">
                            {backup.lastSuccessMethod || "—"}
                            {backup.lastVerifiedAt
                                ? ` · ellenőrizve ${formatDateTime(backup.lastVerifiedAt)}`
                                : ""}
                        </p>
                        {backup.sameVolumeAsApp ? (
                            <p className="mt-2 text-sm text-yellow-300">
                                Figyelem: BACKUP_DIR az app kötetén van.
                            </p>
                        ) : null}
                    </div>
                    <div className="rounded-xl bg-gray-800 p-4">
                        <p className="text-sm text-gray-400">Utolsó futás</p>
                        <p className="mt-1 font-semibold">
                            {backup.last?.ok === false
                                ? "Sikertelen"
                                : backup.last?.ok
                                  ? "Sikeres"
                                  : "—"}
                        </p>
                        <a href="/admin/backups" className="text-sm text-yellow-300 underline">
                            Mentések
                        </a>
                    </div>
                </div>

                <h2 className="text-xl font-semibold mb-3">Email</h2>
                <div className="mb-8 rounded-xl bg-gray-800 p-4">
                    <p>
                        Egymást követő SMTP hibák:{" "}
                        <strong>
                            {email.consecutiveFailures ?? 0} / {email.threshold ?? 5}
                        </strong>
                    </p>
                    {email.lastError && (
                        <p className="mt-2 text-sm text-red-300">
                            {email.lastRecipient || ""} · {email.lastError}
                            {email.lastAt ? ` · ${formatDateTime(email.lastAt)}` : ""}
                        </p>
                    )}
                </div>

                <h2 className="text-xl font-semibold mb-3">Riasztások</h2>
                <ul className="space-y-2 text-sm">
                    {(data?.events || []).length === 0 && (
                        <li className="text-gray-400">Nincs ops esemény.</li>
                    )}
                    {(data?.events || []).map((row: any) => (
                        <li key={row.id} className="rounded-xl bg-gray-800 p-3">
                            <p className="font-semibold">
                                {row.kind} · {row.service}
                            </p>
                            <p className="text-red-300">{row.message}</p>
                            <p className="text-xs text-gray-500">
                                {row.createdAt ? formatDateTime(row.createdAt) : ""}
                            </p>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
