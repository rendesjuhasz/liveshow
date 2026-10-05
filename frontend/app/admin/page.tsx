"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/api/http";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { streamerStatusLabel } from "@/lib/streamer-status";
import { ADMIN_MENUS } from "@/lib/admin-menus";
import AdminHubSidebar from "@/components/AdminHubSidebar";
import { useMounted } from "@/lib/use-mounted";

function HubFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-dvh bg-gray-900 text-white md:flex">
            <AdminHubSidebar />
            <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
        </div>
    );
}

export default function AdminPage() {
    const mounted = useMounted();
    const { user, ready } = useAuth();
    const [pendingStreamers, setPendingStreamers] = useState<any[]>([]);

    useEffect(() => {
        if (!ready || !user || !isAdmin(user)) return;
        apiFetch("/admin/streamers")
            .then((d) => {
                const rows = Array.isArray(d) ? d : [];
                setPendingStreamers(rows.filter((s) => s.status === "pending"));
            })
            .catch(() => setPendingStreamers([]));
    }, [ready, user]);

    if (!mounted || !ready) {
        return (
            <HubFrame>
                <p>Betöltés...</p>
            </HubFrame>
        );
    }

    if (!user) {
        return (
            <HubFrame>
                <p>Bejelentkezés szükséges.</p>
            </HubFrame>
        );
    }

    if (!isAdmin(user)) {
        return (
            <HubFrame>
                <p>Nincs jogosultságod az admin felülethez.</p>
            </HubFrame>
        );
    }

    const cards = ADMIN_MENUS.filter((m) => m.href !== "/admin");

    return (
        <HubFrame>
            <div className="mx-auto max-w-5xl">
                <h1 className="mb-2 text-2xl font-bold md:text-4xl">Admin vezérlőpult</h1>
                <p className="mb-8 text-sm text-zinc-400">
                    Minden menünél le van írva, mit lehet csinálni. Egy pontra lépve a lista eltűnik,
                    hogy a tartalom kitöltse a képernyőt.
                </p>

                {pendingStreamers.length > 0 && (
                    <div className="mb-8 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-6">
                        <h2 className="mb-3 text-xl font-semibold text-yellow-300">
                            Jóváhagyásra váró tartalomkészítők ({pendingStreamers.length})
                        </h2>
                        <ul className="mb-4 space-y-2">
                            {pendingStreamers.map((s) => (
                                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                        {s.name} · {s.email} · {streamerStatusLabel(s.status)}
                                    </span>
                                    <Link href={`/admin/streamers/${s.id}`} className="text-yellow-300 underline">
                                        Jóváhagyás
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <Link href="/admin/streamers" className="text-sm text-yellow-200 underline">
                            Összes tartalomkészítő
                        </Link>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {cards.map((item) => (
                        <div
                            key={item.href}
                            className={`rounded-xl bg-gray-800 p-6 shadow-lg ${
                                item.featured ? "border border-yellow-500/30 md:col-span-2" : ""
                            }`}
                        >
                            <h2 className="mb-4 text-2xl font-semibold">{item.title}</h2>
                            <p className="mb-4 text-gray-400">{item.canDo}</p>
                            <Link
                                href={item.href}
                                className={
                                    item.featured
                                        ? "block rounded-lg bg-yellow-500 p-3 text-center font-semibold text-black hover:bg-yellow-400"
                                        : "block rounded-lg bg-blue-600 p-3 text-center font-semibold hover:bg-blue-700"
                                }
                            >
                                Belépés
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </HubFrame>
    );
}
