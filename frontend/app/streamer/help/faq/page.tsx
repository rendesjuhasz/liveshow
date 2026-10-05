"use client";

import StreamerShell from "@/components/StreamerShell";
import StreamerFaqList from "@/components/StreamerFaqList";
import { StreamerGateNotice, useStreamerGate } from "@/lib/useStreamerGate";

export default function StreamerHelpFaqPage() {
    const gate = useStreamerGate();
    if (!gate.ok) return <StreamerGateNotice reason={gate.reason} />;

    return (
        <StreamerShell title="Gyakori kérdések">
            <p className="mb-8 max-w-2xl text-sm text-neutral-400">
                Tartalomkészítő súgó: élő adás, hang, kép, jegyek, moderálás és technikai követelmények. A nézői FAQ
                ettől külön van.
            </p>
            <StreamerFaqList />
        </StreamerShell>
    );
}
