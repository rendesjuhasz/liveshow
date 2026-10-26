"use client";

import { useEffect } from "react";
import { StreamerGateNotice, useStreamerGate } from "@/lib/useStreamerGate";
import {
    clearStreamerLoginIntent,
    hasStreamerLoginIntent,
} from "@/lib/streamer-login-intent";

export default function StreamerArea({ children }: { children: React.ReactNode }) {
    const gate = useStreamerGate();

    useEffect(() => {
        if (gate.ok) {
            clearStreamerLoginIntent();
            return;
        }
        if (gate.reason !== "anon") return;
        if (hasStreamerLoginIntent()) return;
        window.location.replace("/");
    }, [gate.ok, gate.reason]);

    if (gate.wait || (gate.reason === "anon" && hasStreamerLoginIntent())) {
        return <p className="p-8 text-white">Betöltés...</p>;
    }

    if (gate.reason === "anon") {
        return <p className="p-8 text-white">Betöltés...</p>;
    }

    if (!gate.ok) {
        return (
            <div className="min-h-dvh bg-neutral-950 text-white">
                <StreamerGateNotice reason={gate.reason} />
            </div>
        );
    }

    return <>{children}</>;
}
