"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, asList } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/I18nProvider";
import { contactLeakWarning } from "@/lib/contact-leak";
import ContactLeakHint from "@/components/ContactLeakHint";

export type WishItem = {
    id: string;
    text: string;
    status: string;
    statusLabel: string;
    visibility?: "public" | "private" | string;
    createdAt: string;
    authorName: string;
    streamer: { id: string; name: string } | null;
};

function statusClass(status: string) {
    if (status === "accepted") return "text-emerald-400";
    if (status === "rejected") return "text-red-400";
    if (status === "completed") return "text-amber-300";
    return "text-yellow-400";
}

const PRIVATE_TAB_KEY = "liveshow_wish_tab";

function privateStatusHu(status: string) {
    if (status === "open") return "Nyitott";
    if (status === "awarded") return "Kiválasztva";
    if (status === "paid") return "Megvásárolva";
    if (status === "expired") return "Lejárt";
    return status;
}

function statusMark(status: string) {
    if (status === "accepted") return "Elfogadva";
    if (status === "rejected") return "Elutasítva";
    if (status === "completed") return "Teljesítve";
    return "Függőben";
}

export function WishStatusLine({ wish }: { wish: WishItem }) {
    const mark = statusMark(wish.status);
    return (
        <div className={cn("mt-3 text-sm font-semibold", statusClass(wish.status))}>
            {wish.status === "pending" && <span>Függőben</span>}
            {wish.status === "accepted" && wish.streamer?.name && (
                <span>
                    Elfogadva
                    <br />
                    Tartalomkészítő: {wish.streamer.name}
                </span>
            )}
            {wish.status === "accepted" && !wish.streamer?.name && <span>Elfogadva</span>}
            {wish.status === "rejected" && <span>Elutasítva</span>}
            {wish.status === "completed" && (
                <span>
                    Teljesítve
                    {wish.streamer?.name ? ` · ${wish.streamer.name}` : ""}
                </span>
            )}
            {wish.status !== "pending" &&
                wish.status !== "accepted" &&
                wish.status !== "rejected" &&
                wish.status !== "completed" && <span>{mark}</span>}
        </div>
    );
}

export default function WishWall() {
    const { user, ready } = useAuth();
    const { t, formatDateTime } = useT();
    const [items, setItems] = useState<WishItem[]>([]);
    const [privateRows, setPrivateRows] = useState<any[]>([]);
    const [text, setText] = useState("");
    const [topic, setTopic] = useState("");
    const [details, setDetails] = useState("");
    const [deadlineHours, setDeadlineHours] = useState(72);
    const [notice, setNotice] = useState("");
    const [visibility, setVisibility] = useState<"public" | "private">("public");
    const [error, setError] = useState("");
    const [okMessage, setOkMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const loadSeq = useRef(0);

    useEffect(() => {
        try {
            const saved = sessionStorage.getItem(PRIVATE_TAB_KEY);
            if (saved === "private" || saved === "public") setVisibility(saved);
        } catch {
            /* ignore */
        }
    }, []);

    async function loadPrivate() {
        const rows = asList(await apiFetch("/private-requests/mine"));
        let extra: any[] = [];
        try {
            extra = asList(await apiFetch("/wishes/mine?visibility=private"));
        } catch {
            extra = [];
        }
        const mapped = extra
            .filter((wish) => !rows.some((row) => row.id === wish.id))
            .map((wish) => ({
                id: wish.id,
                topic: wish.text,
                details: "",
                status: wish.status,
                offerCount: 0,
                deadlineLabel: "Nyilvános fal helyett a régi privát kívánság",
                legacyWish: true,
            }));
        return [...rows, ...mapped];
    }

    async function load(nextVisibility: "public" | "private" = visibility) {
        const seq = ++loadSeq.current;
        try {
            if (nextVisibility === "private") {
                if (!user) {
                    if (seq === loadSeq.current) setItems([]);
                    return;
                }
                const rows = await loadPrivate();
                if (seq !== loadSeq.current) return;
                setPrivateRows(rows);
                setItems([]);
                return;
            }
            const data = await apiFetch("/wishes");
            if (seq !== loadSeq.current) return;
            setItems(asList(data));
        } catch (err: any) {
            if (seq !== loadSeq.current) return;
            if (nextVisibility === "private") {
                setError(err.message || "A privát kívánságok nem tölthetők be.");
            } else {
                setItems([]);
            }
        }
    }

    useEffect(() => {
        apiFetch("/private-requests/meta")
            .then((d) => setNotice(d?.notice || ""))
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        if (!ready) return;
        load(visibility);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, user?.id, visibility]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setOkMessage("");
        const leak =
            visibility === "private" ? contactLeakWarning(topic, details) : contactLeakWarning(text);
        if (leak) {
            setError(leak);
            return;
        }
        setBusy(true);
        try {
            if (visibility === "private") {
                const created = await apiFetch("/private-requests", {
                    method: "POST",
                    body: JSON.stringify({ topic, details, deadlineHours }),
                });
                setTopic("");
                setDetails("");
                let rows: any[] = [];
                try {
                    rows = await loadPrivate();
                } catch {
                    rows = [];
                }
                if (created?.id) {
                    rows = [created, ...rows.filter((row) => row.id !== created.id)];
                }
                setPrivateRows(rows);
                setOkMessage("A privát műsorigény elküldve. Lent a listában látod, a Profil → Privát streamek fülön is.");
                try {
                    sessionStorage.setItem(PRIVATE_TAB_KEY, "private");
                } catch {
                    /* ignore */
                }
            } else {
                await apiFetch("/wishes", {
                    method: "POST",
                    body: JSON.stringify({ text, visibility: "public" }),
                });
                setText("");
            }
            if (visibility !== "private") {
                await load(visibility);
            }
        } catch (err: any) {
            setError(err.message || t("wish.error"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section id="kivansagfal" className="mx-auto mt-16 max-w-3xl px-4 md:px-10">
            <h2 className="mb-2 text-xl font-bold">{t("wish.title")}</h2>
            <p className="mb-6 text-sm text-zinc-400">{t("wish.intro")}</p>

            <div className="mb-6 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    className={cn(
                        "min-h-14 rounded-2xl border px-3 py-3 text-left",
                        visibility === "public"
                            ? "border-accent bg-accent/15 text-white"
                            : "border-white/10 bg-zinc-950 text-zinc-300",
                    )}
                    onClick={() => {
                        setVisibility("public");
                        try {
                            sessionStorage.setItem(PRIVATE_TAB_KEY, "public");
                        } catch {
                            /* ignore */
                        }
                    }}
                >
                    <span className="block font-semibold">{t("wish.public")}</span>
                    <span className="mt-1 block text-xs text-zinc-400">{t("wish.publicHint")}</span>
                </button>
                <button
                    type="button"
                    className={cn(
                        "min-h-14 rounded-2xl border px-3 py-3 text-left",
                        visibility === "private"
                            ? "border-accent bg-accent/15 text-white"
                            : "border-white/10 bg-zinc-950 text-zinc-300",
                    )}
                    onClick={() => {
                        setVisibility("private");
                        try {
                            sessionStorage.setItem(PRIVATE_TAB_KEY, "private");
                        } catch {
                            /* ignore */
                        }
                    }}
                >
                    <span className="block font-semibold">{t("wish.private")}</span>
                    <span className="mt-1 block text-xs text-zinc-400">{t("wish.privateHint")}</span>
                </button>
            </div>

            {ready && user ? (
                <form onSubmit={submit} className="mb-8 rounded-2xl border border-white/10 bg-zinc-950 p-5">
                    {visibility === "private" ? (
                        <div className="grid gap-4">
                            <label className="grid gap-2 text-sm">
                                Milyen témában szeretnél privát műsort?
                                <input
                                    className="h-11 rounded-xl border border-white/10 bg-black px-3 text-base"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    required
                                    minLength={3}
                                />
                            </label>
                            <label className="grid gap-2 text-sm">
                                A műsor részletei
                                <textarea
                                    className="min-h-24 rounded-xl border border-white/10 bg-black p-3 text-base"
                                    value={details}
                                    onChange={(e) => setDetails(e.target.value)}
                                    required
                                    minLength={8}
                                />
                            </label>
                            <label className="grid gap-2 text-sm">
                                Milyen határidőn belül?
                                <select
                                    className="h-11 rounded-xl border border-white/10 bg-black px-3 text-base"
                                    value={deadlineHours}
                                    onChange={(e) => setDeadlineHours(Number(e.target.value))}
                                >
                                    <option value={24}>24 órán belül</option>
                                    <option value={72}>3 napon belül</option>
                                    <option value={168}>1 héten belül</option>
                                    <option value={336}>2 héten belül</option>
                                </select>
                            </label>
                            <p className="text-xs text-zinc-500">{notice}</p>
                        </div>
                    ) : (
                        <label className="grid gap-2 text-sm">
                            {t("wish.prompt")}
                            <textarea
                                className="min-h-24 rounded-xl border border-white/10 bg-black p-3 text-base"
                                placeholder={t("wish.placeholder")}
                                value={text}
                                maxLength={500}
                                onChange={(e) => setText(e.target.value)}
                                required
                                minLength={8}
                            />
                        </label>
                    )}
                    {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                    <ContactLeakHint
                        warning={
                            visibility === "private"
                                ? contactLeakWarning(topic, details)
                                : contactLeakWarning(text)
                        }
                    />
                    {okMessage && visibility === "private" && (
                        <p className="mt-2 text-sm text-green-400">{okMessage}</p>
                    )}
                    <Button type="submit" variant="gold" className="mt-4" disabled={busy}>
                        {busy ? t("auth.busy") : t("wish.submit")}
                    </Button>
                </form>
            ) : (
                <p className="mb-8 text-sm text-zinc-400">
                    {t("wish.login")}{" "}
                    <Link href="/login" className="text-accent hover:underline">
                        {t("wish.loginAction")}
                    </Link>
                    .
                </p>
            )}

            <div className="space-y-3">
                {visibility === "private" ? (
                    <>
                        <h3 className="text-sm font-semibold text-white">Saját privát műsorigényeid</h3>
                        <p className="text-xs text-zinc-500">
                            Ezek nem jelennek meg a nyilvános falon.{" "}
                            <Link href="/profile?tab=private" className="text-accent hover:underline">
                                Profil → Privát streamek
                            </Link>
                        </p>
                        {okMessage && <p className="text-sm text-green-400">{okMessage}</p>}
                        {privateRows.length === 0 && (
                            <p className="text-zinc-500">{t("wish.emptyPrivate")}</p>
                        )}
                        {privateRows.map((row) => (
                            <article key={row.id} className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-semibold">{row.topic}</p>
                                    <span className="text-xs uppercase tracking-wide text-accent">
                                        {privateStatusHu(row.status)} · {row.offerCount || 0} ajánlat
                                    </span>
                                </div>
                                {row.details ? <p className="mt-2 text-zinc-200">{row.details}</p> : null}
                                <p className="mt-2 text-xs text-zinc-500">
                                    {row.deadlineLabel ? `Határidő: ${row.deadlineLabel}` : ""}
                                    {notice ? ` · ${notice}` : ""}
                                </p>
                                {!row.legacyWish && (
                                    <Link
                                        href={`/profile/private/${row.id}`}
                                        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline"
                                    >
                                        Ajánlatok megtekintése
                                    </Link>
                                )}
                            </article>
                        ))}
                    </>
                ) : (
                    <>
                        {items.length === 0 && (
                            <p className="text-zinc-500">{t("wish.emptyPublic")}</p>
                        )}
                        {items.map((wish) => (
                            <article key={wish.id} className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
                                <p className="font-semibold">{wish.authorName}</p>
                                <p className="mt-2 text-zinc-200">„{wish.text}”</p>
                                <WishStatusLine wish={wish} />
                                <p className="mt-1 text-xs text-zinc-500">
                                    {t("wish.submitted")} {formatDateTime(wish.createdAt)}
                                </p>
                            </article>
                        ))}
                    </>
                )}
            </div>
        </section>
    );
}
