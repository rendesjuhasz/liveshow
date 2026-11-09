"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { STREAMER_CATEGORIES } from "@/lib/streamer-categories";
import { contactLeakWarning } from "@/lib/contact-leak";
import ContactLeakHint from "@/components/ContactLeakHint";
import PasswordField from "@/components/PasswordField";

export default function StreamerRegisterPage() {
    const router = useRouter();
    const { registerStreamer } = useAuth();
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [bio, setBio] = useState("");
    const [category, setCategory] = useState("talkshow");
    const [contactEmail, setContactEmail] = useState("");
    const [avatar, setAvatar] = useState<File | null>(null);
    const [terms, setTerms] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (!avatar) {
            setError("A profilkép kötelező.");
            return;
        }
        if (!terms) {
            setError("A Tartalomkészítő ÁSZF elfogadása kötelező.");
            return;
        }
        const leak = contactLeakWarning(bio, name);
        if (leak) {
            setError(leak);
            return;
        }

        const form = new FormData();
        form.append("name", name);
        form.append("username", username);
        form.append("email", email);
        form.append("password", password);
        form.append("bio", bio);
        form.append("category", category);
        form.append("contactEmail", contactEmail);
        form.append("termsAccepted", "true");
        form.append("avatar", avatar);

        setBusy(true);
        try {
            await registerStreamer(form);
            router.push("/streamer");
        } catch (err: any) {
            setError(err?.message || "Hiba történt a tartalomkészítő regisztráció során.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="min-h-dvh bg-background px-4 py-10 text-white sm:py-16">
            <div className="max-w-xl mx-auto">
                <p className="text-sm text-yellow-400 mb-2">Tartalomkészítő fiók</p>
                <h1 className="mb-2 text-2xl font-bold md:text-3xl">Tartalomkészítő regisztráció</h1>
                <p className="text-neutral-400 mb-8">
                    A fiók pending státusszal jön létre, a dashboard csak admin jóváhagyás után nyílik meg.
                    Megerősítő e-mailt is küldünk; jegy és tartalomkészítő műveletekhez a linkre kell kattintani.
                    Csak nézni szeretnél?{" "}
                    <Link href="/register" className="text-yellow-400 underline">
                        Nézői regisztráció
                    </Link>
                    .
                </p>

                <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl bg-neutral-900 p-4 sm:p-6">
                    <label className="grid gap-1">
                        <span>Felhasználónév</span>
                        <input
                            className="p-3 rounded text-black"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase())}
                            minLength={3}
                            maxLength={24}
                            required
                        />
                    </label>
                    <p className="text-xs text-neutral-400">
                        3–24 karakter, csak angol kisbetű, szám és aláhúzás. Később nem módosítható.
                    </p>
                    <label className="grid gap-1">
                        <span>Teljes név</span>
                        <input
                            className="p-3 rounded text-black"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </label>
                    <label className="grid gap-1">
                        <span>Email (belépéshez)</span>
                        <input
                            className="p-3 rounded text-black"
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (!contactEmail || contactEmail === email) {
                                    setContactEmail(e.target.value);
                                }
                            }}
                            required
                        />
                    </label>
                    <label className="grid gap-1">
                        <span>Jelszó</span>
                        <PasswordField
                            className="p-3 rounded text-black"
                            tone="onLight"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={8}
                            required
                        />
                    </label>
                    <label className="grid gap-1">
                        <span>Bemutatkozás</span>
                        <textarea
                            className="p-3 rounded text-black min-h-28"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            required
                        />
                    </label>
                    <ContactLeakHint warning={contactLeakWarning(bio)} />
                    <label className="grid gap-1">
                        <span>Profilkép</span>
                        <input
                            className="p-3 rounded bg-neutral-800"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={(e) => setAvatar(e.target.files?.[0] || null)}
                            required
                        />
                    </label>
                    <label className="grid gap-1">
                        <span>Kategória</span>
                        <select
                            className="p-3 rounded text-black"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            required
                        >
                            {STREAMER_CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="grid gap-1">
                        <span>Kapcsolattartási email</span>
                        <p className="text-xs text-neutral-500">
                            A platform adminjának szól, nem jelenik meg a nyilvános profilon, és
                            nem használható a nézőkkel való közvetlen egyeztetésre.
                        </p>
                        <input
                            className="p-3 rounded text-black"
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            required
                        />
                    </label>
                    <label className="flex min-h-11 items-start gap-3 text-sm">
                        <input
                            className="mt-1 size-5 shrink-0"
                            type="checkbox"
                            checked={terms}
                            onChange={(e) => setTerms(e.target.checked)}
                            required
                        />
                        <span>
                            Elfogadom a{" "}
                            <Link href="/streamer-terms" className="text-yellow-400 underline" target="_blank">
                                Tartalomkészítő ÁSZF
                            </Link>
                            , az{" "}
                            <Link href="/aszf" className="text-yellow-400 underline" target="_blank">
                                ÁSZF
                            </Link>
                            {" "}és az{" "}
                            <Link href="/adatkezeles" className="text-yellow-400 underline" target="_blank">
                                Adatkezelési tájékoztató
                            </Link>{" "}
                            feltételeit.
                        </span>
                    </label>
                    {error && <p className="text-red-400">{error}</p>}
                    <button
                        type="submit"
                        disabled={busy}
                        className="bg-yellow-500 text-black font-bold p-3 rounded-xl disabled:opacity-50"
                    >
                        {busy ? "Küldés..." : "Tartalomkészítő regisztráció"}
                    </button>
                </form>
            </div>
        </div>
    );
}
