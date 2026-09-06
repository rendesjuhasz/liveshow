"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { isAdmin, useAuth } from "@/context/AuthContext";
import { streamerStatusLabel } from "@/lib/streamer-status";

export default function AdminPage() {
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

    if (!ready) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-900 text-white">
                <p>Betöltés...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-900 text-white">
                <p>Bejelentkezés szükséges.</p>
            </div>
        );
    }

    if (!isAdmin(user)) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-900 text-white">
                <p>Nincs jogosultságod az admin felülethez.</p>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-gray-900 p-4 text-white md:p-8">
            <div className="mx-auto max-w-5xl">
                <h1 className="mb-8 text-2xl font-bold md:text-4xl">Admin vezérlőpult</h1>

                {pendingStreamers.length > 0 && (
                    <div className="mb-8 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-6">
                        <h2 className="text-xl font-semibold text-yellow-300 mb-3">
                            Jóváhagyásra váró streamerek ({pendingStreamers.length})
                        </h2>
                        <ul className="space-y-2 mb-4">
                            {pendingStreamers.map((s) => (
                                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                        {s.name} · {s.email} · {streamerStatusLabel(s.status)}
                                    </span>
                                    <a href={`/admin/streamers/${s.id}`} className="text-yellow-300 underline">
                                        Jóváhagyás
                                    </a>
                                </li>
                            ))}
                        </ul>
                        <a href="/admin/streamers" className="text-sm text-yellow-200 underline">
                            Összes streamer
                        </a>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Műsorok kezelése</h2>
                        <p className="text-gray-400 mb-4">
                            Új műsor létrehozása, időpontok, élő link, archívum. A nézés ingyenes.
                        </p>
                        <a
                            href="/admin/shows"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Felhasználók</h2>
                        <p className="text-gray-400 mb-4">
                            Összes user és streamer, tiltás, aktiválás, jóváhagyás, profilok.
                        </p>
                        <a
                            href="/admin/users"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Streamerek</h2>
                        <p className="text-gray-400 mb-4">
                            Streamerek jóváhagyása, elutasítása, tiltása, profilok.
                        </p>
                        <a
                            href="/admin/streamers"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Kérdések</h2>
                        <p className="text-gray-400 mb-4">
                            Beküldött kérdések jóváhagyása, audit napló, tiltott szavak.
                        </p>
                        <a
                            href="/admin/questions"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Értékelések</h2>
                        <p className="text-gray-400 mb-4">
                            Műsor utáni csillagos és szöveges értékelések jóváhagyása, elutasítása.
                        </p>
                        <a
                            href="/admin/reviews"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Moderátorok</h2>
                        <p className="text-gray-400 mb-4">
                            Felhasználói szerepkörök, moderátori jogosultságok.
                        </p>
                        <a
                            href="/admin/moderators"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Privát stream ársávok</h2>
                        <p className="text-gray-400 mb-4">
                            1–5 csillagos kategóriák minimum és maximum ára. Csak ezen belül adhat
                            ajánlatot a streamer.
                        </p>
                        <a
                            href="/admin/private-pricing"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Privát biztonsági mentések</h2>
                        <p className="text-gray-400 mb-4">
                            30 napig őrzött, nem nyilvános felvételek vita vagy káros tartalom esetén.
                        </p>
                        <a
                            href="/admin/private-backups"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Jegycsomagok</h2>
                        <p className="text-gray-400 mb-4">
                            Alap, Ezüst, Arany, Gyémánt csomagárak (kérdés / értékelés). Az élő és az
                            archív nézés ingyenes.
                        </p>
                        <a
                            href="/admin/ticket-categories"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Jegyek</h2>
                        <p className="text-gray-400 mb-4">
                            Ajándék jegyek kiosztása, jegykezelés, ellenőrzés.
                        </p>
                        <a
                            href="/admin/tickets"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Ajándék kampányok</h2>
                        <p className="text-gray-400 mb-4">
                            Kampányok: első X felhasználó vagy első X vásárló ingyenjegye.
                        </p>
                        <a
                            href="/admin/campaigns"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Kifizetések</h2>
                        <p className="text-gray-400 mb-4">
                            Streamerek bevételei, jóváhagyások, státuszok.
                        </p>
                        <a
                            href="/admin/payments"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Ajánlóprogram</h2>
                        <p className="text-gray-400 mb-4">
                            Beállítások, ajánlások, jutalomjegyek és kiosztott ajándékjegy statisztika.
                        </p>
                        <a
                            href="/admin/referrals"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Statisztikák</h2>
                        <p className="text-gray-400 mb-4">
                            Jegyeladások, nézőszámok, bevételek, platform teljesítmény.
                        </p>
                        <a
                            href="/admin/stats"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Email értesítések</h2>
                        <p className="text-gray-400 mb-4">
                            Automatikus levelek: regisztráció, jegy, emlékeztető, archívum, streamer
                            és kifizetés jóváhagyás.
                        </p>
                        <a
                            href="/admin/emails"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Kapcsolat üzenetek</h2>
                        <p className="text-gray-400 mb-4">
                            A Kapcsolat űrlapon beérkezett üzenetek.
                        </p>
                        <a
                            href="/admin/contact"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
                        <p className="text-gray-400 mb-4">
                            Gyakori kérdések létrehozása, szerkesztése, kategória és sorrend.
                        </p>
                        <a
                            href="/admin/faq"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4">Nyelvek és fordítások</h2>
                        <p className="text-gray-400 mb-4">
                            Nyelvek, UI kulcsok, lefedettség, hiányzó fordítások, jóváhagyás.
                        </p>
                        <a
                            href="/admin/i18n"
                            className="block bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-center font-semibold"
                        >
                            Belépés
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
