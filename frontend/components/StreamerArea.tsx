"use client";

import { useEffect } from "react";
import { StreamerGateNotice, useStreamerGate } from "@/lib/useStreamerGate";

export default function StreamerArea({ children }: { children: React.ReactNode }) {
    const gate = useStreamerGate();

    useEffect(() => {
        if (gate.reason === "anon") window.location.replace("/");
    }, [gate.reason]);

    if (gate.wait || gate.reason === "anon") {
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
