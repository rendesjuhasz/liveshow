"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiUpload, publicAssetUrl } from "@/api/http";
import StreamerShell from "@/components/StreamerShell";
import { useStreamerGate } from "@/lib/useStreamerGate";
import { STREAMER_CATEGORIES } from "@/lib/streamer-categories";
import { useAuth } from "@/context/AuthContext";
import { contactLeakWarning } from "@/lib/contact-leak";
import ContactLeakHint from "@/components/ContactLeakHint";

function LegalForm() {
    const [legal, setLegal] = useState<any>(null);
    const [invoiceCapable, setInvoiceCapable] = useState(false);
    const [method, setMethod] = useState("bank_transfer");
    const [tax, setTax] = useState(false);
    const [contract, setContract] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        apiFetch("/streamer/legal")
            .then((d) => {
                setLegal(d);
                setInvoiceCapable(Boolean(d?.invoiceCapable));
                setMethod(d?.preferredPayoutMethod || "bank_transfer");
                setTax(Boolean(d?.taxDeclarationAcceptedAt));
                setContract(Boolean(d?.contractShareAcceptedAt));
            })
            .catch(() => undefined);
    }, []);

    return (
        <form
            className="max-w-xl grid gap-4 bg-neutral-900 p-6 rounded-2xl mt-8"
            onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setMessage("");
                try {
                    const next = await apiFetch("/streamer/legal", {
                        method: "PATCH",
                        body: JSON.stringify({
                            invoiceCapable,
                            preferredPayoutMethod: method,
                            taxDeclarationAccepted: tax && !legal?.taxDeclarationAcceptedAt,
                            contractShareAccepted: contract && !legal?.contractShareAcceptedAt,
                        }),
                    });
                    setLegal(next);
                    setMessage("A jogi nyilatkozatok mentve. A platform ezeket nyilvántartja, a számlázást te intézed.");
                } catch (err: any) {
                    setError(err.message || "Mentés sikertelen.");
                }
            }}
        >
            <h2 className="text-xl font-bold">Számla, adó, szerződés</h2>
            <p className="text-sm text-neutral-400">
                A platform nem ad számlát és nem intézi az adózást, csak tárolja a nyilatkozatokat (GDPR: a kifizetési
                adatok a kifizetés teljesítéséhez kellenek).
            </p>
            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={invoiceCapable} onChange={(e) => setInvoiceCapable(e.target.checked)} />
                Számlát tudok adni a kifizetésről
            </label>
            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={tax} onChange={(e) => setTax(e.target.checked)} />
                Adózási nyilatkozatot elfogadom
            </label>
            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={contract} onChange={(e) => setContract(e.target.checked)} />
                A szerződéses részesedési feltételeket elfogadom
            </label>
            <label className="grid gap-1 text-sm">
                Preferált kifizetési mód
                <select className="p-3 rounded text-black" value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="bank_transfer">Banki átutalás</option>
                    <option value="other">Egyéb</option>
                </select>
            </label>
            {error && <p className="text-red-400">{error}</p>}
            {message && <p className="text-green-400">{message}</p>}
            <button className="bg-neutral-800 font-bold p-3 rounded-xl">Nyilatkozatok mentése</button>
        </form>
    );
}

export default function StreamerProfilePage() {
    const gate = useStreamerGate();
    const { refreshUser } = useAuth();
    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [category, setCategory] = useState("egyeb");
    const [contactEmail, setContactEmail] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [publicLinks, setPublicLinks] = useState<{ label: string; url: string }[]>([]);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!gate.ok) return;
        apiFetch("/streamers/me")
            .then((d) => {
                const s = d?.streamer;
                if (!s) return;
                setName(s.name || "");
                setBio(s.bio || "");
                setCategory(s.category || "egyeb");
                setContactEmail(s.contactEmail || "");
                setAvatarUrl(s.avatarUrl || "");
                const rows = Array.isArray(s.publicLinks) ? s.publicLinks : [];
                setPublicLinks(
                    rows
                        .map((row: any) => ({
                            label: String(row?.label || ""),
                            url: String(row?.url || ""),
                        }))
                        .filter((row: { label: string; url: string }) => row.label || row.url)
                        .slice(0, 5),
                );
            })
            .catch((err: any) => setError(err.message || "Nem sikerült betölteni a profilt."));
    }, [gate.ok]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setMessage("");
        const leak = contactLeakWarning(bio, name);
        if (leak) {
            setError(leak);
            return;
        }
        const form = new FormData();
        form.append("name", name);
        form.append("bio", bio);
        form.append("category", category);
        form.append("contactEmail", contactEmail);
        form.append("publicLinks", JSON.stringify(publicLinks.filter((row) => row.label.trim() || row.url.trim())));
        if (file) form.append("avatar", file);
        try {
            const updated = await apiUpload("/streamer/profile", form, "PATCH");
            setAvatarUrl(updated.avatarUrl || avatarUrl);
            if (Array.isArray(updated.publicLinks)) {
                setPublicLinks(updated.publicLinks);
            }
            await refreshUser().catch(() => undefined);
            setMessage("A profil mentve.");
        } catch (err: any) {
            setError(err.message || "Nem sikerült menteni a profilt.");
        }
    }

    if (gate.wait) return <p className="p-8 text-white">Betöltés...</p>;
    if (!gate.ok) return <p className="p-8 text-white">A tartalomkészítő felülethez jóváhagyott fiók kell.</p>;

    return (
        <StreamerShell title="Profil szerkesztés">
            <form onSubmit={submit} className="max-w-xl grid gap-4 bg-neutral-900 p-6 rounded-2xl">
                {avatarUrl && (
                    <img src={publicAssetUrl(avatarUrl)} alt="" className="w-20 h-20 rounded-full object-cover" />
                )}
                <label className="grid gap-1">
                    Teljes név
                    <input className="p-3 rounded text-black" value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label className="grid gap-1">
                    Bemutatkozás
                    <textarea className="p-3 rounded text-black min-h-24" value={bio} onChange={(e) => setBio(e.target.value)} />
                </label>
                <ContactLeakHint warning={contactLeakWarning(bio)} />
                <div className="grid gap-2">
                    <p className="font-semibold">Nyilvános linkek</p>
                    <p className="text-xs text-neutral-500">
                        Legfeljebb 5 https-link. A nézők csak az archív videó alatt látják. Élő adásban, chatben
                        és kérdésnél nem jelennek meg. Discord-meghívó (discord.gg / discord.com/invite) engedélyezett.
                    </p>
                    {publicLinks.map((row, index) => (
                        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                            <input
                                className="p-3 rounded text-black"
                                placeholder="Címke (pl. Instagram)"
                                value={row.label}
                                maxLength={40}
                                onChange={(e) => {
                                    const next = [...publicLinks];
                                    next[index] = { ...next[index], label: e.target.value };
                                    setPublicLinks(next);
                                }}
                            />
                            <input
                                className="p-3 rounded text-black"
                                placeholder="https://"
                                value={row.url}
                                maxLength={500}
                                onChange={(e) => {
                                    const next = [...publicLinks];
                                    next[index] = { ...next[index], url: e.target.value };
                                    setPublicLinks(next);
                                }}
                            />
                            <button
                                type="button"
                                className="rounded-xl bg-neutral-800 px-3 py-2 text-sm"
                                onClick={() => setPublicLinks(publicLinks.filter((_, i) => i !== index))}
                            >
                                Törlés
                            </button>
                        </div>
                    ))}
                    {publicLinks.length < 5 && (
                        <button
                            type="button"
                            className="justify-self-start rounded-xl bg-neutral-800 px-3 py-2 text-sm"
                            onClick={() => setPublicLinks([...publicLinks, { label: "", url: "" }])}
                        >
                            Link hozzáadása
                        </button>
                    )}
                </div>
                <label className="grid gap-1">
                    Kategória
                    <select className="p-3 rounded text-black" value={category} onChange={(e) => setCategory(e.target.value)}>
                        {STREAMER_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-1">
                    Kapcsolattartási email
                    <span className="text-xs text-neutral-500">
                        Csak a platform és az admin látja. A nézőknek nem jelenik meg, és nem
                        használható a nézőkkel való közvetlen kapcsolattartásra.
                    </span>
                    <input className="p-3 rounded text-black" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
                </label>
                <label className="grid gap-1">
                    Új profilkép
                    <input className="p-3 rounded bg-neutral-800" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
                {error && <p className="text-red-400">{error}</p>}
                {message && <p className="text-green-400">{message}</p>}
                <button className="bg-yellow-500 text-black font-bold p-3 rounded-xl">Mentés</button>
            </form>
            <LegalForm />
        </StreamerShell>
    );
}
