"use client";

import { useState } from "react";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";

export default function ContactPage() {
    const { user } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState(user?.email || "");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setSending(true);
        try {
            await apiFetch("/api/contact", {
                method: "POST",
                body: JSON.stringify({ name, email, message }),
            });
            setDone(true);
        } catch (err: any) {
            setError(err.message || "Az üzenet küldése sikertelen.");
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="min-h-dvh bg-background px-4 py-10 text-white sm:py-16">
            <div className="max-w-lg mx-auto">
                <h1 className="text-3xl font-bold mb-2">Kapcsolat</h1>
                <p className="text-neutral-400 mb-8">
                    Ez az űrlap a LiveShow ügyfélszolgálatának szól (jegyek, fiók, közvetítés).
                    Streamerekkel és nézőkkel e-mailben vagy telefonon nem lehet közvetlenül
                    kapcsolatot keresni: a beszélgetés a platformon belüli kérdéseken, kívánságokon
                    és privát műsorajánlatokon keresztül marad.
                </p>

                {done ? (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
                        <h2 className="text-2xl font-bold mb-3">Köszönjük!</h2>
                        <p className="text-neutral-300">
                            Megkaptuk az üzenetedet, hamarosan válaszolunk.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={submit} className="grid gap-4 bg-neutral-900 p-6 rounded-2xl">
                        <label className="grid gap-1">
                            <span>Név</span>
                            <input
                                className="h-11 rounded-xl border border-white/10 bg-black px-3"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                minLength={2}
                            />
                        </label>
                        <label className="grid gap-1">
                            <span>Email cím</span>
                            <input
                                className="h-11 rounded-xl border border-white/10 bg-black px-3"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </label>
                        <label className="grid gap-1">
                            <span>Üzenet</span>
                            <textarea
                                className="min-h-40 rounded-xl border border-white/10 bg-black p-3"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                required
                                minLength={10}
                                maxLength={5000}
                            />
                        </label>
                        {error && <p className="text-red-400">{error}</p>}
                        <button
                            type="submit"
                            disabled={sending}
                            className="bg-yellow-500 text-black font-bold p-3 rounded-xl disabled:opacity-60"
                        >
                            {sending ? "Küldés..." : "Üzenet elküldése"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
