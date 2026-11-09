"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/api/http";
import {
    MARKETING_TABS,
    type MarketingKit,
    type MarketingPublish,
    type SocialAccount,
} from "@/lib/marketing-kit";
import { useT } from "@/lib/i18n/I18nProvider";

function kitText(kit: MarketingKit, tab: string) {
    if (tab === "facebook") return kit.facebookPost;
    if (tab === "linkedin") return kit.linkedinPost;
    if (tab === "x") return kit.xPost;
    if (tab === "newsletter") return kit.newsletterContent;
    if (tab === "youtube") return kit.youtubeDescription;
    if (tab === "blog") return kit.blogOutline;
    if (tab === "seo") return `${kit.seoTitle}\n\n${kit.seoDescription}`;
    if (tab === "email") {
        return [`1) ${kit.emailSubject1}`, `2) ${kit.emailSubject2}`, `3) ${kit.emailSubject3}`].join("\n");
    }
    const tags = (kit.hashtags || []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    const cta = (kit.ctaVariants || []).map((c, i) => `${i + 1}. ${c}`).join("\n");
    const promo = (kit.promoPhrases || []).map((c, i) => `${i + 1}. ${c}`).join("\n");
    return `Hashtag pack:\n${tags}\n\nCTA:\n${cta}\n\nRövid szlogenek:\n${promo}`;
}

function fieldForTab(tab: string): keyof MarketingKit | null {
    const map: Record<string, keyof MarketingKit> = {
        facebook: "facebookPost",
        linkedin: "linkedinPost",
        x: "xPost",
        newsletter: "newsletterContent",
        youtube: "youtubeDescription",
        blog: "blogOutline",
    };
    return map[tab] || null;
}

export default function MarketingKitCard({ showId }: { showId: string }) {
    const { formatDateTime } = useT();
    const [kit, setKit] = useState<MarketingKit | null>(null);
    const [count, setCount] = useState(0);
    const [accounts, setAccounts] = useState<SocialAccount[]>([]);
    const [publishes, setPublishes] = useState<MarketingPublish[]>([]);
    const [tab, setTab] = useState<(typeof MARKETING_TABS)[number]["id"]>("facebook");
    const [language, setLanguage] = useState<"hu" | "en">("hu");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const [provider, setProvider] = useState("facebook");
    const [accountId, setAccountId] = useState("");
    const [mode, setMode] = useState<"now" | "schedule">("now");
    const [when, setWhen] = useState("");

    const load = useCallback(async () => {
        const data = await apiFetch(`/ai/marketing-kit/${showId}`);
        setKit(data?.marketingKit || null);
        setCount(Number(data?.generationCount || 0));
        setAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
        setPublishes(Array.isArray(data?.publishes) ? data.publishes : []);
    }, [showId]);

    useEffect(() => {
        if (!showId) return;
        load().catch((err: any) => setError(err.message || "Nem sikerült betölteni a kitet."));
    }, [showId, load]);

    useEffect(() => {
        if (!busy) return;
        setProgress(8);
        const t = setInterval(() => setProgress((p) => (p >= 90 ? 90 : p + 7)), 400);
        return () => clearInterval(t);
    }, [busy]);

    const preview = useMemo(() => (kit ? kitText(kit, tab) : ""), [kit, tab]);

    async function generate() {
        setError("");
        setBusy(true);
        setProgress(5);
        try {
            const data = await apiFetch("/ai/marketing-kit/generate", {
                method: "POST",
                body: JSON.stringify({ streamId: showId, language }),
            });
            setKit(data?.marketingKit || null);
            setProgress(100);
            await load();
        } catch (err: any) {
            setError(err.message || "A generálás nem sikerült.");
        } finally {
            setBusy(false);
        }
    }

    async function saveEdit() {
        if (!kit) return;
        const field = fieldForTab(tab);
        setError("");
        try {
            if (tab === "seo") {
                const [title, ...rest] = draft.split("\n\n");
                await apiFetch(`/ai/marketing-kit/${kit.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ seoTitle: title, seoDescription: rest.join("\n\n") }),
                });
            } else if (tab === "email") {
                const lines = draft.split("\n").map((l) => l.replace(/^\d+\)\s*/, ""));
                await apiFetch(`/ai/marketing-kit/${kit.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        emailSubject1: lines[0] || kit.emailSubject1,
                        emailSubject2: lines[1] || kit.emailSubject2,
                        emailSubject3: lines[2] || kit.emailSubject3,
                    }),
                });
            } else if (tab === "hashtags") {
                const tags = (draft.match(/#?[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű0-9_]+/g) || []).map((t) => t.replace(/^#/, ""));
                await apiFetch(`/ai/marketing-kit/${kit.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ hashtags: tags.slice(0, 20) }),
                });
            } else if (field) {
                await apiFetch(`/ai/marketing-kit/${kit.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ [field]: draft }),
                });
            }
            setEditing(false);
            await load();
        } catch (err: any) {
            setError(err.message || "Mentés sikertelen.");
        }
    }

    async function connect(p: string) {
        setError("");
        try {
            const data = await apiFetch(`/ai/marketing-kit/oauth/${p}/start`, {
                method: "POST",
                body: JSON.stringify({ streamId: showId }),
            });
            if (data?.url) window.location.href = data.url;
        } catch (err: any) {
            setError(err.message || "OAuth indítás sikertelen.");
        }
    }

    async function publish() {
        if (!kit || !accountId) return;
        setError("");
        try {
            await apiFetch(`/ai/marketing-kit/${kit.id}/publish`, {
                method: "POST",
                body: JSON.stringify({
                    provider,
                    accountId,
                    mode,
                    scheduledAt: mode === "schedule" ? new Date(when).toISOString() : undefined,
                }),
            });
            await load();
        } catch (err: any) {
            setError(err.message || "Közzététel sikertelen.");
        }
    }

    const filteredAccounts = accounts.filter((a) => a.provider === provider);

    return (
        <section className="mt-8 max-w-3xl rounded-2xl border border-white/10 bg-neutral-900 p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold">AI Marketing Kit</h2>
                    <p className="text-sm text-neutral-400">
                        Egy kattintással poszt, SEO, hírlevél és YouTube leírás a műsorból.
                    </p>
                    {kit?.generatedAt && (
                        <p className="mt-1 text-xs text-neutral-500">
                            Utoljára: {formatDateTime(kit.generatedAt)} · {kit.model} ·{" "}
                            {(kit.durationMs / 1000).toFixed(1)}s · {count} sikeres generálás
                        </p>
                    )}
                </div>
                <label className="text-sm text-neutral-400">
                    Nyelv
                    <select
                        className="ml-2 rounded bg-neutral-800 p-2 text-white"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as "hu" | "en")}
                    >
                        <option value="hu">Magyar</option>
                        <option value="en">English</option>
                    </select>
                </label>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={busy}
                    onClick={generate}
                    className="rounded-xl bg-yellow-500 px-4 py-2 font-bold text-black disabled:opacity-50"
                >
                    {kit ? "Újragenerálás" : "Marketing kit készítése"}
                </button>
            </div>

            {busy && (
                <div className="mb-4">
                    <p className="mb-1 text-sm text-neutral-400">Generálás… {progress}%</p>
                    <div className="h-2 overflow-hidden rounded bg-neutral-800">
                        <div className="h-full bg-yellow-500 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            )}

            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

            {kit && (
                <>
                    <div className="mb-3 flex flex-wrap gap-1">
                        {MARKETING_TABS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                    setTab(t.id);
                                    setEditing(false);
                                }}
                                className={`rounded-lg px-3 py-1.5 text-sm ${
                                    tab === t.id ? "bg-yellow-500 font-semibold text-black" : "bg-neutral-800 text-neutral-200"
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="mb-2 flex gap-2">
                        <button
                            type="button"
                            className="rounded-lg bg-neutral-800 px-3 py-1 text-sm"
                            onClick={() => navigator.clipboard.writeText(preview)}
                        >
                            Másolás
                        </button>
                        <button
                            type="button"
                            className="rounded-lg bg-neutral-800 px-3 py-1 text-sm"
                            onClick={() => {
                                setDraft(preview);
                                setEditing(true);
                            }}
                        >
                            Szerkesztés
                        </button>
                    </div>

                    {editing ? (
                        <div className="grid gap-2">
                            <textarea
                                className="min-h-40 rounded-xl p-3 text-black"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <button type="button" className="rounded-lg bg-yellow-500 px-3 py-1 font-bold text-black" onClick={saveEdit}>
                                    Mentés
                                </button>
                                <button type="button" className="rounded-lg bg-neutral-800 px-3 py-1" onClick={() => setEditing(false)}>
                                    Mégse
                                </button>
                            </div>
                        </div>
                    ) : (
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-sm text-neutral-100">
                            {preview}
                        </pre>
                    )}

                    {(kit.webinarVersion || kit.businessVersion) && (
                        <div className="mt-4 grid gap-3 text-sm">
                            {kit.webinarVersion ? (
                                <div>
                                    <p className="mb-1 font-semibold text-yellow-400">Webinárium verzió</p>
                                    <p className="whitespace-pre-wrap text-neutral-300">{kit.webinarVersion}</p>
                                </div>
                            ) : null}
                            {kit.businessVersion ? (
                                <div>
                                    <p className="mb-1 font-semibold text-yellow-400">Üzleti verzió</p>
                                    <p className="whitespace-pre-wrap text-neutral-300">{kit.businessVersion}</p>
                                </div>
                            ) : null}
                        </div>
                    )}

                    <div className="mt-6 border-t border-white/10 pt-4">
                        <h3 className="mb-2 font-semibold">Publish Everywhere</h3>
                        <p className="mb-3 text-xs text-neutral-500">
                            Facebook Page, LinkedIn és X. A tokenek titkosítva a szerveren. Azonnali vagy ütemezett poszt, újrapróbálás hibánál.
                        </p>
                        <div className="mb-3 flex flex-wrap gap-2">
                            <button type="button" className="rounded-lg bg-neutral-800 px-3 py-1 text-sm" onClick={() => connect("facebook")}>
                                Facebook csatlakozás
                            </button>
                            <button type="button" className="rounded-lg bg-neutral-800 px-3 py-1 text-sm" onClick={() => connect("linkedin")}>
                                LinkedIn csatlakozás
                            </button>
                            <button type="button" className="rounded-lg bg-neutral-800 px-3 py-1 text-sm" onClick={() => connect("x")}>
                                X csatlakozás
                            </button>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                            <select className="rounded bg-neutral-800 p-2" value={provider} onChange={(e) => setProvider(e.target.value)}>
                                <option value="facebook">Facebook</option>
                                <option value="linkedin">LinkedIn</option>
                                <option value="x">X</option>
                            </select>
                            <select className="rounded bg-neutral-800 p-2" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                                <option value="">Fiók…</option>
                                {filteredAccounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.accountName}
                                    </option>
                                ))}
                            </select>
                            <select className="rounded bg-neutral-800 p-2" value={mode} onChange={(e) => setMode(e.target.value as "now" | "schedule")}>
                                <option value="now">Azonnal</option>
                                <option value="schedule">Ütemezés</option>
                            </select>
                            {mode === "schedule" && (
                                <input
                                    type="datetime-local"
                                    className="rounded bg-neutral-800 p-2"
                                    value={when}
                                    onChange={(e) => setWhen(e.target.value)}
                                />
                            )}
                        </div>
                        <button
                            type="button"
                            className="mt-3 rounded-xl bg-blue-600 px-4 py-2 font-bold disabled:opacity-50"
                            disabled={!accountId}
                            onClick={publish}
                        >
                            Közzététel
                        </button>
                        {publishes.length > 0 && (
                            <ul className="mt-3 space-y-2 text-sm">
                                {publishes.map((p) => (
                                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/30 p-2">
                                        <span>
                                            {p.provider} · {p.status}
                                            {p.lastError ? ` · ${p.lastError}` : ""}
                                            {p.externalId ? ` · id ${p.externalId}` : ""}
                                        </span>
                                        {p.status === "failed" && (
                                            <button
                                                type="button"
                                                className="text-yellow-400"
                                                onClick={async () => {
                                                    await apiFetch(`/ai/marketing-kit/publish/${p.id}/retry`, { method: "POST" });
                                                    await load();
                                                }}
                                            >
                                                Újra
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
