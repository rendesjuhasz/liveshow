"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/api/http";
import { useAdminGate } from "@/lib/useAdminGate";

const LENGTHS = [15, 30, 60, 90, 120];

type Settings = Record<string, any>;

export default function AdminMarketingPage() {
    const gate = useAdminGate();
    const [tab, setTab] = useState("settings");
    const [data, setData] = useState<any>(null);
    const [settings, setSettings] = useState<Settings>({});
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    async function load() {
        const row = await apiFetch("/admin/marketing");
        setData(row);
        setSettings(row?.settings || {});
    }

    useEffect(() => {
        if (!gate.ok) return;
        load().catch((err) => setError(err.message || "Betöltés sikertelen."));
    }, [gate.ok]);

    async function save() {
        setError("");
        setMessage("");
        try {
            const next = await apiFetch("/admin/marketing/settings", {
                method: "PUT",
                body: JSON.stringify(settings),
            });
            setSettings(next);
            setMessage("Mentve. A rendszer a háttérben dolgozik, a tartalomkészítőnek nem kell nyomkodnia.");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Mentés sikertelen.");
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">Nincs jogosultság.</p>;

    const tabs = [
        ["settings", "Beállítások"],
        ["clips", "Klipkezelő"],
        ["social", "Platformok"],
        ["jobs", "Értesítések / AI"],
        ["stats", "Statisztika"],
    ] as const;

    return (
        <div className="min-h-dvh bg-gray-900 p-4 text-white md:p-8">
            <div className="mx-auto max-w-5xl">
                <p className="mb-2 text-sm text-yellow-300">
                    <a href="/admin" className="underline">
                        Admin
                    </a>{" "}
                    / Marketing központ
                </p>
                <h1 className="mb-2 text-3xl font-bold">Automatikus marketing</h1>
                <p className="mb-6 max-w-3xl text-sm text-gray-400">
                    Élő adás közben a nézőknek nincs reklám overlay, banner vagy felugró elem. A
                    rendszer klipeket vág, szöveget generál, és a közösségi fiókokra ütemez — a
                    tartalomkészítőnek nem kell belenyúlnia.
                </p>
                <div className="mb-6 flex flex-wrap gap-2">
                    {tabs.map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            className={`rounded-xl px-3 py-2 text-sm ${tab === id ? "bg-yellow-500 font-semibold text-black" : "bg-gray-800"}`}
                            onClick={() => setTab(id)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {error && <p className="mb-3 text-red-400">{error}</p>}
                {message && <p className="mb-3 text-emerald-300">{message}</p>}

                {tab === "settings" && (
                    <form
                        className="grid gap-4 rounded-2xl bg-gray-800 p-5"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void save();
                        }}
                    >
                        <Toggle
                            label="Automatikus klip (néző / chat / kérdés / reakció csúcs)"
                            checked={Boolean(settings.clipEnabled)}
                            onChange={(v) => setSettings({ ...settings, clipEnabled: v })}
                        />
                        <label className="grid gap-1 text-sm">
                            Klip hossz
                            <select
                                className="rounded bg-gray-900 p-2"
                                value={settings.clipLengthSec || 30}
                                onChange={(e) => setSettings({ ...settings, clipLengthSec: Number(e.target.value) })}
                            >
                                {LENGTHS.map((n) => (
                                    <option key={n} value={n}>
                                        {n} mp
                                    </option>
                                ))}
                            </select>
                        </label>
                        <Toggle
                            label="AI marketing szöveg a stream után"
                            checked={Boolean(settings.autoKitEnabled)}
                            onChange={(v) => setSettings({ ...settings, autoKitEnabled: v })}
                        />
                        <Toggle
                            label="Következő stream promó"
                            checked={Boolean(settings.nextShowPromoEnabled)}
                            onChange={(v) => setSettings({ ...settings, nextShowPromoEnabled: v })}
                        />
                        <Toggle
                            label="Jegy / indulás emlékeztető (2 óra, 30 perc + email)"
                            checked={Boolean(settings.ticketPromoEnabled)}
                            onChange={(v) => setSettings({ ...settings, ticketPromoEnabled: v })}
                        />
                        <Toggle
                            label="Automatikus képgenerálás (borító / story)"
                            checked={Boolean(settings.imageGenEnabled)}
                            onChange={(v) => setSettings({ ...settings, imageGenEnabled: v })}
                        />
                        <h2 className="mt-2 font-semibold">TikTok</h2>
                        <Toggle
                            label="Automatikus TikTok feltöltés"
                            checked={Boolean(settings.tiktokEnabled)}
                            onChange={(v) => setSettings({ ...settings, tiktokEnabled: v })}
                        />
                        <Num label="Max videó naponta" value={settings.tiktokMaxPerDay} onChange={(v) => setSettings({ ...settings, tiktokMaxPerDay: v })} />
                        <Toggle label="Automatikus felirat" checked={Boolean(settings.tiktokCaptions)} onChange={(v) => setSettings({ ...settings, tiktokCaptions: v })} />
                        <Toggle label="Automatikus hashtag" checked={Boolean(settings.tiktokHashtags)} onChange={(v) => setSettings({ ...settings, tiktokHashtags: v })} />
                        <h2 className="mt-2 font-semibold">Facebook Reels</h2>
                        <Toggle
                            label="Automatikus Facebook Reels"
                            checked={Boolean(settings.facebookReelsEnabled)}
                            onChange={(v) => setSettings({ ...settings, facebookReelsEnabled: v })}
                        />
                        <Num label="Napi maximum Reels" value={settings.facebookMaxPerDay} onChange={(v) => setSettings({ ...settings, facebookMaxPerDay: v })} />
                        <Toggle
                            label="Automatikus publikálás"
                            checked={Boolean(settings.facebookAutoPublish)}
                            onChange={(v) => setSettings({ ...settings, facebookAutoPublish: v })}
                        />
                        <Toggle
                            label="Kézi jóváhagyás"
                            checked={Boolean(settings.facebookManualApproval)}
                            onChange={(v) => setSettings({ ...settings, facebookManualApproval: v })}
                        />
                        <h2 className="mt-2 font-semibold">Instagram / YouTube</h2>
                        <Toggle
                            label="Instagram (15/30/60 mp Reel, story, poszt)"
                            checked={Boolean(settings.instagramEnabled)}
                            onChange={(v) => setSettings({ ...settings, instagramEnabled: v })}
                        />
                        <Toggle
                            label="YouTube Shorts (Top 5 streamből)"
                            checked={Boolean(settings.youtubeShortsEnabled)}
                            onChange={(v) => setSettings({ ...settings, youtubeShortsEnabled: v })}
                        />
                        <h2 className="mt-2 font-semibold">Értesítési csatornák</h2>
                        <Toggle label="Email" checked={Boolean(settings.notifyEmail)} onChange={(v) => setSettings({ ...settings, notifyEmail: v })} />
                        <Toggle label="Push (in-app)" checked={Boolean(settings.notifyPush)} onChange={(v) => setSettings({ ...settings, notifyPush: v })} />
                        <Toggle label="Discord webhook" checked={Boolean(settings.notifyDiscord)} onChange={(v) => setSettings({ ...settings, notifyDiscord: v })} />
                        <input
                            className="rounded bg-gray-900 p-2 text-sm"
                            placeholder="Discord webhook URL"
                            value={settings.discordWebhook || ""}
                            onChange={(e) => setSettings({ ...settings, discordWebhook: e.target.value })}
                        />
                        <Toggle label="Telegram" checked={Boolean(settings.notifyTelegram)} onChange={(v) => setSettings({ ...settings, notifyTelegram: v })} />
                        <input
                            className="rounded bg-gray-900 p-2 text-sm"
                            placeholder="Telegram chat id"
                            value={settings.telegramChatId || ""}
                            onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                        />
                        <button className="mt-2 rounded-xl bg-yellow-500 px-4 py-2 font-bold text-black">Mentés</button>
                    </form>
                )}

                {tab === "clips" && (
                    <ul className="space-y-3">
                        {!(data?.clips || []).length && <li className="text-gray-500">Még nincs klip. Élő adás aktivitási csúcsainál készül.</li>}
                        {(data?.clips || []).map((c: any) => (
                            <li key={c.id} className="rounded-xl bg-gray-800 p-4 text-sm">
                                <p className="font-semibold">
                                    {c.rank ? `${c.rank}. legjobb jelenet · ` : ""}
                                    {c.reason} · {c.durationSec} mp · {c.status}
                                </p>
                                <p className="text-gray-400">
                                    néző {c.viewers} · chat {c.chatCount} · kérdés {c.questionCount} · reakció{" "}
                                    {c.supportCount} · score {Number(c.score || 0).toFixed(1)}
                                </p>
                                {c.status === "ready" ? (
                                    <a className="text-yellow-300 underline" href={`/api/admin/marketing/clips/${c.id}/file`} target="_blank" rel="noreferrer">
                                        Klip
                                    </a>
                                ) : (
                                    <p className="text-gray-500">{c.lastError || "Vágás a felvétel után."}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {tab === "social" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(data?.connections || {}).map(([k, v]) => (
                            <div key={k} className="rounded-xl bg-gray-800 p-4">
                                <p className="font-semibold capitalize">{k}</p>
                                <p className={v ? "text-emerald-300" : "text-gray-500"}>
                                    {v ? "Csatlakoztatva (OAuth)" : "Nincs fiók — a job vár / jóváhagyásra kerül"}
                                </p>
                            </div>
                        ))}
                        <p className="sm:col-span-2 text-sm text-gray-400">
                            Facebook, LinkedIn, X a meglévő Marketing Kit OAuth. TikTok, Instagram, YouTube
                            Shorts feltöltés a klipekkel készül, a platform kulcs után megy ki.
                        </p>
                    </div>
                )}

                {tab === "jobs" && (
                    <ul className="space-y-3">
                        {!(data?.jobs || []).length && <li className="text-gray-500">Nincs marketing feladat.</li>}
                        {(data?.jobs || []).map((j: any) => (
                            <li key={j.id} className="rounded-xl bg-gray-800 p-4 text-sm">
                                <p className="font-semibold">
                                    {j.type} · {j.channel} · {j.status}
                                </p>
                                {j.lastError ? <p className="text-gray-400">{j.lastError}</p> : null}
                                {j.status === "needs_approval" && (
                                    <button
                                        type="button"
                                        className="mt-2 rounded bg-yellow-500 px-3 py-1 font-semibold text-black"
                                        onClick={async () => {
                                            await apiFetch(`/admin/marketing/jobs/${j.id}`, {
                                                method: "PATCH",
                                                body: JSON.stringify({ status: "pending" }),
                                            });
                                            await load();
                                        }}
                                    >
                                        Jóváhagyás
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {tab === "stats" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(data?.stats || {})
                            .filter(([k]) => k !== "note")
                            .map(([k, v]) => (
                                <div key={k} className="rounded-xl bg-gray-800 p-4">
                                    <p className="text-sm text-gray-400">{k}</p>
                                    <p className="text-2xl font-bold">{String(v)}</p>
                                </div>
                            ))}
                        <p className="sm:col-span-2 text-sm text-gray-500">{data?.stats?.note}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            {label}
        </label>
    );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <label className="grid gap-1 text-sm">
            {label}
            <input
                type="number"
                min={1}
                max={20}
                className="rounded bg-gray-900 p-2"
                value={value || 1}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </label>
    );
}
