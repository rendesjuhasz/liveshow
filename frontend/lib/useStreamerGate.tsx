"use client";

import Link from "next/link";
import { isAdmin, isStreamer, useAuth } from "@/context/AuthContext";

export function useStreamerGate() {
    const { user, ready } = useAuth();
    if (!ready) return { ok: false, wait: true, user: null, reason: "wait" as const };
    if (!user) return { ok: false, wait: false, user: null, reason: "anon" as const };
    if (!isStreamer(user) && !isAdmin(user)) {
        return { ok: false, wait: false, user, reason: "forbidden" as const };
    }
    return { ok: true, wait: false, user, reason: "ok" as const };
}

function BackHomeLink() {
    return (
        <Link href="/" className="inline-block text-accent underline">
            Vissza a LiveShow főoldalra
        </Link>
    );
}

export function StreamerGateNotice({
    reason,
}: {
    reason: "wait" | "anon" | "forbidden" | "ok";
}) {
    if (reason === "wait") {
        return <p className="p-8 text-white">Betöltés...</p>;
    }
    if (reason === "anon") {
        return (
            <div className="p-8 text-white">
                <BackHomeLink />
                <p className="mt-6">
                    Ez a tartalomkészítő stúdió, nem a nyilvános LiveShow. Belépés nélkül a főoldal a nyilvános nézői
                    felület.
                </p>
                <Link href="/streamer-login" className="mt-4 inline-block text-sm text-zinc-400 underline">
                    Tartalomkészítő belépés
                </Link>
            </div>
        );
    }
    return (
        <div className="p-8 text-white">
            <BackHomeLink />
            <p className="mt-6">
                Ez a belépés nézői fiók. A stúdióhoz lépj ki, majd a tartalomkészítő email címmel a Tartalomkészítő
                belépésen gyere be.
            </p>
            <Link href="/streamer-login" className="mt-4 inline-block text-sm text-zinc-400 underline">
                Tartalomkészítő belépés
            </Link>
        </div>
    );
}
