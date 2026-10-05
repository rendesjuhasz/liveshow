"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";

type Notice = { tone: "warning" | "danger"; title: string; text: string };

export default function StreamerMaintenanceNotice() {
    const [notice, setNotice] = useState<Notice | null>(null);

    useEffect(() => {
        let stop = false;
        const load = () =>
            apiFetch("/maintenance/current")
                .then((data) => {
                    if (!stop) setNotice(data?.streamer || null);
                })
                .catch(() => {
                    if (!stop) setNotice(null);
                });
        void load();
        const t = setInterval(() => void load(), 30_000);
        return () => {
            stop = true;
            clearInterval(t);
        };
    }, []);

    if (!notice) return null;
    const danger = notice.tone === "danger";
    return (
        <div
            className={`mb-6 rounded-xl border px-4 py-3 ${
                danger
                    ? "border-red-500/50 bg-red-950/70 text-red-100"
                    : "border-amber-400/50 bg-amber-950/70 text-amber-100"
            }`}
        >
            <p className="font-semibold">{notice.title}</p>
            <p className="text-sm opacity-90">{notice.text}</p>
        </div>
    );
}
