"use client";

import StreamerShell from "@/components/StreamerShell";
import StreamerPreflight from "@/components/StreamerPreflight";
import { StreamerGateNotice, useStreamerGate } from "@/lib/useStreamerGate";
import Link from "next/link";

export default function StreamerPreflightPage() {
    const gate = useStreamerGate();
    if (!gate.ok) return <StreamerGateNotice reason={gate.reason} />;

    return (
        <StreamerShell title="Adás előtti ellenőrzés">
            <div className="mx-auto grid max-w-md gap-4">
                <StreamerPreflight />
                <Link
                    href="/streamer/live"
                    className="min-h-12 rounded-2xl bg-green-600 px-4 py-3 text-center text-lg font-bold"
                >
                    ✅ Élő adás indítása
                </Link>
            </div>
        </StreamerShell>
    );
}
