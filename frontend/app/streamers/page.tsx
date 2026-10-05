"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, publicAssetUrl } from "@/api/http";
import LocaleLink from "@/components/LocaleLink";
import { useT } from "@/lib/i18n/I18nProvider";

export default function StreamersPage() {
    const { t } = useT();
    const [rows, setRows] = useState<any[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        apiFetch("/streamers")
            .then((d) => setRows(Array.isArray(d) ? d : []))
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni a tartalomkészítőket."));
    }, []);

    return (
        <div className="mx-auto min-h-dvh max-w-5xl px-4 py-10 md:px-10">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
                <h1 className="text-3xl font-extrabold">{t("streamers.title")}</h1>
                <LocaleLink href="/leaderboard" className="text-sm font-semibold text-accent hover:underline">
                    {t("nav.leaderboard")}
                </LocaleLink>
            </div>
            {error && <p className="text-red-400">{error}</p>}
            {rows.length === 0 && !error && <p className="text-zinc-400">Még nincs jóváhagyott tartalomkészítő.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
                {rows.map((s) => (
                    <Link
                        key={s.id}
                        href={`/streamers/${s.id}`}
                        className="flex items-center gap-4 rounded-2xl border border-white/10 bg-zinc-950 p-4 hover:bg-white/5"
                    >
                        {s.avatarUrl ? (
                            <img
                                src={publicAssetUrl(s.avatarUrl)}
                                alt=""
                                className="size-16 rounded-2xl object-cover"
                            />
                        ) : (
                            <div className="flex size-16 items-center justify-center rounded-2xl bg-accent font-black text-black">
                                {(s.name || "?").charAt(0)}
                            </div>
                        )}
                        <div>
                            <p className="font-semibold">{s.name}</p>
                            <p className="text-sm text-zinc-400">
                                {s.average ?? 0} / 5 · {s.reviewCount ?? 0} értékelés
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
