"use client";

import { useEffect, useState } from "react";
import { apiFetch, publicAssetUrl } from "@/api/http";
import LocaleLink from "@/components/LocaleLink";
import { useT } from "@/lib/i18n/I18nProvider";

type Row = {
    rank: number;
    id: string;
    name: string;
    avatarUrl?: string | null;
};

export default function PublicLeaderboardPage() {
    const { t, locale } = useT();
    const [rows, setRows] = useState<Row[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        apiFetch("/streamers/leaderboard")
            .then((d) => setRows(Array.isArray(d) ? d : []))
            .catch((err: any) => setError(err.message || t("leaderboard.error")))
            .finally(() => setLoading(false));
    }, [locale, t]);

    return (
        <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10 md:px-10">
            <h1 className="mb-3 text-3xl font-extrabold">{t("leaderboard.title")}</h1>
            <p className="mb-8 max-w-xl text-sm text-zinc-400">{t("leaderboard.intro")}</p>
            {loading && <p className="text-zinc-400">{t("common.loading")}</p>}
            {error && <p className="text-red-400">{error}</p>}
            {!loading && !error && rows.length === 0 && (
                <p className="text-zinc-400">{t("leaderboard.empty")}</p>
            )}
            <ol className="space-y-2">
                {rows.map((row) => (
                    <li key={row.id}>
                        <LocaleLink
                            href={`/streamers/${row.id}`}
                            className="flex min-h-14 items-center gap-4 rounded-2xl border border-white/10 bg-zinc-950 px-3 py-3 hover:bg-white/5"
                        >
                            <span className="w-8 shrink-0 text-center text-lg font-black text-accent">
                                {row.rank}.
                            </span>
                            {row.avatarUrl ? (
                                <img
                                    src={publicAssetUrl(row.avatarUrl)}
                                    alt=""
                                    className="size-11 rounded-full object-cover"
                                />
                            ) : (
                                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent font-black text-black">
                                    {(row.name || "?").charAt(0)}
                                </div>
                            )}
                            <span className="min-w-0 truncate font-semibold">{row.name}</span>
                        </LocaleLink>
                    </li>
                ))}
            </ol>
        </div>
    );
}
