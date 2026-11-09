"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { displayInitial, displayName } from "@/lib/display-name";
import { apiFetch, asList } from "@/api/http";
import { ticketStatusLabelHu, isTicketActiveStatus } from "@/lib/ticket-status";
import TicketPackShop from "@/components/TicketPackShop";
import { getFavorites, getWatched, type LibraryCard } from "@/lib/library";
import EventCard from "@/components/media/EventCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/I18nProvider";

function NotificationPrefs() {
    const [prefs, setPrefs] = useState({
        notifyNewShow: true,
        notify24h: true,
        notify1h: true,
        notifyLive: true,
        emailEnabled: true,
    });
    const [saved, setSaved] = useState("");

    useEffect(() => {
        apiFetch("/notifications/prefs")
            .then((data) => setPrefs((p) => ({ ...p, ...data })))
            .catch(() => undefined);
    }, []);

    const toggle = async (key: keyof typeof prefs) => {
        const next = { ...prefs, [key]: !prefs[key] };
        setPrefs(next);
        setSaved("");
        try {
            const savedPrefs = await apiFetch("/notifications/prefs", {
                method: "PATCH",
                body: JSON.stringify(next),
            });
            setPrefs((p) => ({ ...p, ...savedPrefs }));
            setSaved("Beállítások mentve.");
        } catch {
            setPrefs(prefs);
            setSaved("A mentés nem sikerült.");
        }
    };

    const rows: { key: keyof typeof prefs; label: string }[] = [
        { key: "notifyNewShow", label: "Értesítés új eseményről" },
        { key: "notify24h", label: "Értesítés 24 órával előtte" },
        { key: "notify1h", label: "Értesítés 1 órával előtte" },
        { key: "notifyLive", label: "Értesítés induláskor" },
        { key: "emailEnabled", label: "Email értesítés" },
    ];

    return (
        <div className="mb-8 rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <h2 className="mb-1 text-xl font-extrabold">Értesítési beállítások</h2>
            <p className="mb-4 text-sm text-zinc-400">
                A követett tartalomkészítők új és közelgő eseményeiről. Privát műsorról csak a megrendelő kap
                értesítést.
            </p>
            <ul className="space-y-2">
                {rows.map((row) => (
                    <li key={row.key}>
                        <label className="flex cursor-pointer items-center gap-3 text-sm">
                            <input
                                type="checkbox"
                                className="size-4 accent-yellow-400"
                                checked={Boolean(prefs[row.key])}
                                onChange={() => toggle(row.key)}
                            />
                            {row.label}
                        </label>
                    </li>
                ))}
            </ul>
            {saved && <p className="mt-3 text-sm text-zinc-400">{saved}</p>}
        </div>
    );
}

type Tab = "purchases" | "private" | "favorites" | "watched";

const REFERRAL_STATUS_HU: Record<string, string> = {
    pending: "Függő — még nincs elég vásárlás",
    completed: "Teljesült",
    rewarded: "Jutalom jóváírva",
};

function ReferralSection() {
    const [data, setData] = useState<any>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    const [origin, setOrigin] = useState("");

    useEffect(() => {
        setOrigin(window.location.origin);
        apiFetch("/referrals/me")
            .then(setData)
            .catch((err: any) => setError(err.message || "Az ajánló adatok nem tölthetők be."));
    }, []);

    const link = origin && data?.referralCode ? `${origin}/register?ref=${data.referralCode}` : "";

    return (
        <div className="mb-8 rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <h2 className="mb-1 text-xl font-extrabold">Ajánlóprogram</h2>
            <p className="mb-4 text-sm text-zinc-400">
                Oszd meg a linkedet. A jutalom akkor jár, ha az ajánlott néző legalább{" "}
                {data?.minimumPurchasedTickets ?? 10} jegyet vásárol. Te {data?.rewardTicketAmount ?? 5} ingyen
                jegyet kapsz a meglévő egyenlegedre.
            </p>
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            {data && !data.enabled && (
                <p className="mb-3 text-sm text-zinc-500">Az ajánlóprogram jelenleg ki van kapcsolva.</p>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                    readOnly
                    className="h-11 min-w-[220px] flex-1 rounded-xl border border-white/10 bg-black px-3 text-sm"
                    value={link}
                />
                <Button
                    type="button"
                    variant="gold"
                    disabled={!link}
                    onClick={async () => {
                        if (!link) return;
                        await navigator.clipboard.writeText(link);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1600);
                    }}
                >
                    {copied ? "Másolva" : "Link másolása"}
                </Button>
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 px-4 py-3">
                    <p className="text-xs text-zinc-400">Sikeres ajánlások</p>
                    <p className="text-2xl font-extrabold">{data?.successfulReferrals ?? 0}</p>
                </div>
                <div className="rounded-xl border border-white/10 px-4 py-3">
                    <p className="text-xs text-zinc-400">Szerzett jutalomjegy</p>
                    <p className="text-2xl font-extrabold">{data?.totalRewardTickets ?? 0}</p>
                </div>
            </div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-300">Ajánlások története</h3>
            {(data?.history || []).length === 0 && (
                <p className="text-sm text-zinc-500">Még senki nem regisztrált a linkeddel.</p>
            )}
            <ul className="space-y-2 text-sm">
                {(data?.history || []).map((row: any) => (
                    <li key={row.id} className="rounded-xl border border-white/10 px-4 py-3">
                        <span className="font-semibold">{row.referredName}</span>
                        {" · "}
                        {REFERRAL_STATUS_HU[row.status] || row.status}
                        {" · "}
                        {row.qualifyingPurchaseTickets} vásárolt jegy
                    </li>
                ))}
            </ul>
        </div>
    );
}

type MyTicket = {
    id: string;
    showId: string;
    price: number;
    status: string;
    createdAt: string;
    show?: {
        id: string;
        title: string;
        startTime: string;
        live?: boolean;
        streamId?: string | null;
        image?: string | null;
    };
};

export default function ProfilePage() {
    const { user, ready, logout, refreshUser } = useAuth();
    const { t } = useT();
    const [name, setName] = useState("");
    const [nameMessage, setNameMessage] = useState("");
    const [nameError, setNameError] = useState("");
    const [balance, setBalance] = useState(0);
    const [giftBalance, setGiftBalance] = useState(0);
    const [tickets, setTickets] = useState<MyTicket[]>([]);
    const [lots, setLots] = useState<any[]>([]);
    const [ticketsError, setTicketsError] = useState("");
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [resendNote, setResendNote] = useState("");
    const [tab, setTab] = useState<Tab>("purchases");
    const [favs, setFavs] = useState<ReturnType<typeof getFavorites>>([]);
    const [watched, setWatched] = useState<LibraryCard[]>([]);
    const [privateRows, setPrivateRows] = useState<any[]>([]);

    const applyWallet = (d: any) => {
        const nextLots = Array.isArray(d?.lots) ? d.lots : [];
        setLots(nextLots);
        const total = Number(d?.balance || 0);
        const fromLots = nextLots.reduce((sum: number, lot: any) => {
            if (String(lot.status) !== "paid") return sum;
            const source = String(lot.source || "purchase");
            const groupKey = String(lot.groupKey || "");
            const isGift = source !== "purchase" || groupKey === "gift";
            return isGift ? sum + Number(lot.remainingCount || 0) : sum;
        }, 0);
        const fromApi = Number(d?.giftBalance ?? d?.giftbalance);
        const gift = Number.isFinite(fromApi) ? Math.max(fromApi, fromLots) : fromLots;
        setBalance(total);
        setGiftBalance(gift);
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("tab") === "private") setTab("private");
    }, []);

    useEffect(() => {
        if (!ready || !user) return;
        setName(displayName(user));
        setTicketsLoading(true);
        apiFetch("/tickets/my")
            .then((data) => {
                const list = Array.isArray(data) ? data : data?.tickets;
                setTickets(Array.isArray(list) ? list : []);
            })
            .catch((err: any) => setTicketsError(err.message || "Nem sikerült betölteni a jegyeket."))
            .finally(() => setTicketsLoading(false));
        apiFetch("/tickets/balance")
            .then((d) => applyWallet(d))
            .catch(() => undefined);
        setFavs(getFavorites(user.id));
        setWatched(getWatched(user.id));
        apiFetch("/private-requests")
            .then((data) => setPrivateRows(asList(data)))
            .catch(() =>
                apiFetch("/private-requests/mine")
                    .then((data) => setPrivateRows(asList(data)))
                    .catch(() => setPrivateRows([])),
            );
        refreshUser().catch(() => undefined);
    }, [ready, user?.id]);

    if (!ready) {
        return <p className="px-6 py-20 text-zinc-400">Betöltés...</p>;
    }

    if (!user) {
        return (
            <div className="px-6 py-24 text-center">
                <p className="mb-4 text-zinc-300">Nincs bejelentkezve.</p>
                <Button asChild variant="gold">
                    <Link href="/login">Belépés</Link>
                </Button>
            </div>
        );
    }

    const tabs: { id: Tab; label: string }[] = [
        { id: "purchases", label: "Vásárlásaim" },
        { id: "private", label: "Privát streamek" },
        { id: "favorites", label: "Kedvenceim" },
        { id: "watched", label: "Megtekintett" },
    ];

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-10 md:py-10">
            <div className="mb-10 flex items-center gap-4">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-accent text-2xl font-black text-black">
                    {displayInitial(user)}
                </div>
                <div className="min-w-0">
                    <h1 className="text-2xl font-extrabold">{displayName(user)}</h1>
                    <p className="truncate text-sm text-zinc-400">
                        {t("profile.title")} · {user.email}
                        {user.username ? ` · @${user.username}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-accent">{user.xp ?? 0} XP</p>
                    {(user.badges || []).length > 0 && (
                        <div className="mt-3 space-y-2">
                            {(user.badges || [])
                                .filter((b, i, arr) => arr.findIndex((x) => x.key === b.key) === i)
                                .map((b) => (
                                    <div
                                        key={b.key}
                                        className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm"
                                    >
                                        <p className="font-semibold text-accent">{b.title}</p>
                                        <p className="text-zinc-400">{b.description}</p>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            <form
                className="mb-8 flex flex-wrap items-end gap-3"
                onSubmit={async (e) => {
                    e.preventDefault();
                    setNameError("");
                    setNameMessage("");
                    try {
                        await apiFetch("/auth/profile", {
                            method: "PATCH",
                            body: JSON.stringify({ name }),
                        });
                        await refreshUser();
                        setNameMessage("A név mentve.");
                    } catch (err: any) {
                        setNameError(err.message || "A név mentése nem sikerült.");
                    }
                }}
            >
                <label className="grid min-w-0 w-full flex-1 gap-1 text-sm sm:min-w-[220px]">
                    {t("profile.displayName")}
                    <input
                        className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-base"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </label>
                <Button type="submit" variant="gold">
                    Név mentése
                </Button>
                {nameMessage && <p className="text-sm text-green-400">{nameMessage}</p>}
                {nameError && <p className="text-sm text-red-400">{nameError}</p>}
            </form>

            <div className="mb-8 max-w-xs">
                <LanguageSwitcher />
            </div>

            <ReferralSection />

            <NotificationPrefs />

            <div className="mb-8 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {tabs.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setTab(item.id)}
                        className={cn(
                            "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold",
                            tab === item.id ? "bg-white text-black" : "bg-white/5 text-zinc-300 hover:bg-white/10",
                        )}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === "purchases" && (
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
                            <p className="text-sm text-zinc-400">{t("tickets.balance")}</p>
                            <p className="text-3xl font-extrabold">{Math.max(0, balance - giftBalance)} db</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
                            <p className="text-sm text-zinc-400">{t("tickets.gift")}</p>
                            <p className="text-3xl font-extrabold">{giftBalance} db</p>
                        </div>
                    </div>
                    <TicketPackShop
                        onBought={() => {
                            apiFetch("/tickets/balance")
                                .then((d) => applyWallet(d))
                                .catch(() => undefined);
                        }}
                    />
                    {lots.length > 0 && (
                        <ul className="space-y-2 text-sm">
                            {lots.map((lot) => {
                                const isGift =
                                    String(lot.source || "purchase") !== "purchase" ||
                                    String(lot.groupKey || "") === "gift";
                                return (
                                    <li key={lot.id} className="rounded-xl border border-white/10 px-4 py-3">
                                        {isGift ? `${t("tickets.gift")} · ` : ""}
                                        {lot.groupName} · {lot.remainingCount}/{lot.ticketCount} jegy ·{" "}
                                        {lot.unitValue} Ft/jegy · {lot.status}
                                        {lot.source === "referral" ? " · ajánló jutalom" : ""}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {ticketsLoading && <p className="text-zinc-400">Jegyek betöltése...</p>}
                    {ticketsError && <p className="text-red-400">{ticketsError}</p>}
                    {resendNote && <p className="text-emerald-400">{resendNote}</p>}
                    {tickets.map((ticket) => (
                        <div
                            key={ticket.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-950 p-4"
                        >
                            <Link href={`/shows/${ticket.showId}`} className="min-w-0 hover:text-accent">
                                <p className="font-semibold">{ticket.show?.title || "Esemény"}</p>
                                <p className="text-sm text-zinc-400">
                                    {ticket.price} Ft · {ticketStatusLabelHu(ticket.status)}
                                </p>
                            </Link>
                            {isTicketActiveStatus(ticket.status) && (
                                <button
                                    type="button"
                                    className="text-sm text-accent hover:underline"
                                    onClick={async () => {
                                        try {
                                            setResendNote("");
                                            await apiFetch(`/tickets/${ticket.id}/resend`, { method: "POST" });
                                            setTicketsError("");
                                            setResendNote("A jegy e-mailje újraküldve.");
                                        } catch (err: any) {
                                            setResendNote("");
                                            setTicketsError(err.message || "Az újraküldés nem sikerült.");
                                        }
                                    }}
                                >
                                    E-mail újraküldése
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {tab === "private" && (
                <div className="space-y-3">
                    <p className="text-sm text-zinc-400">
                        Privát kívánságok, beérkezett ajánlatok és vásárlás. A felvétel 30 napig csak
                        az admin biztonsági mentésében marad, nem kerül nyilvános oldalra.
                    </p>
                    {privateRows.length === 0 && (
                        <p className="text-zinc-400">Még nincs privát kívánságod. A Kívánságfalon hozhatsz létre egyet.</p>
                    )}
                    {privateRows.map((row) => (
                        <Link
                            key={row.id}
                            href={`/profile/private/${row.id}`}
                            className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950 p-4 hover:bg-white/5"
                        >
                            <div>
                                <p className="font-semibold">{row.topic}</p>
                                <p className="text-sm text-zinc-400">
                                    {row.status === "open" ? "Nyitott" : row.status} · {row.offers?.length || row.offerCount || 0} ajánlat
                                </p>
                            </div>
                            <span className="text-sm text-accent">Részletek</span>
                        </Link>
                    ))}
                </div>
            )}

            {tab === "favorites" && (
                <div className="flex flex-wrap gap-4">
                    {favs.length === 0 && <p className="text-zinc-400">Még nincs kedvenced. Nyomj szívet egy kártyán.</p>}
                    {favs.map((f) => (
                        <EventCard key={f.id} item={{ id: f.id, title: f.title, image: f.image, startTime: f.startTime }} />
                    ))}
                </div>
            )}

            {tab === "watched" && (
                <div className="flex flex-wrap gap-4">
                    {watched.length === 0 && <p className="text-zinc-400">Még nem rögzítettünk megtekintést.</p>}
                    {watched.map((f) => (
                        <EventCard key={f.id} item={{ id: f.id, title: f.title, image: f.image, startTime: f.startTime }} />
                    ))}
                </div>
            )}

            <Button variant="outline" className="mt-12" onClick={logout}>
                {t("nav.logout")}
            </Button>
        </div>
    );
}
