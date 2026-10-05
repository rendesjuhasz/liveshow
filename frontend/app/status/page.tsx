"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useT } from "@/lib/i18n/I18nProvider";

const STATUS_CLASS: Record<string, string> = {
    operational: "text-emerald-400",
    maintenance: "text-amber-300",
    degraded: "text-amber-400",
    outage: "text-red-400",
};

const DOT: Record<string, string> = {
    operational: "bg-emerald-400",
    maintenance: "bg-amber-300",
    degraded: "bg-amber-400",
    outage: "bg-red-500",
};

export default function StatusPage() {
    const { t } = useT();
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = () =>
            apiFetch("/status")
                .then(setData)
                .catch((err) => setError(err.message || "A státusz nem tölthető be."));
        void load();
        const timer = setInterval(() => void load(), 20_000);
        return () => clearInterval(timer);
    }, []);

    const overall = String(data?.overall || "");
    return (
        <div className="min-h-dvh bg-background px-4 py-10 text-white sm:py-16">
            <div className="mx-auto max-w-3xl">
                <h1 className="mb-2 text-3xl font-bold md:text-4xl">{t("status.pageTitle")}</h1>
                <p className={`mb-8 text-sm ${STATUS_CLASS[overall] || "text-neutral-400"}`}>
                    {overall ? t(`status.${overall}`) : "…"}
                    {data?.updatedAt ? ` · ${t("status.updated")} ${new Date(data.updatedAt).toLocaleString("hu-HU")}` : ""}
                </p>
                {error && <p className="mb-4 text-red-400">{error}</p>}
                {data?.maintenance && (
                    <div className="mb-8 rounded-xl border border-amber-400/40 bg-amber-950/40 p-4">
                        <p className="font-semibold">{data.maintenance.title}</p>
                        <p className="text-sm text-amber-100/90">{data.maintenance.text}</p>
                    </div>
                )}
                <ul className="space-y-3">
                    {(data?.components || []).map((row: { id: string; label: string; status: string }) => (
                        <li
                            key={row.id}
                            className="flex items-center justify-between rounded-xl border border-white/10 bg-card px-4 py-3"
                        >
                            <span className="flex items-center gap-3">
                                <span className={`h-2.5 w-2.5 rounded-full ${DOT[row.status] || "bg-neutral-500"}`} />
                                {row.label}
                            </span>
                            <span className={`text-sm font-medium ${STATUS_CLASS[row.status] || ""}`}>
                                {t(`status.${row.status}`)}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
