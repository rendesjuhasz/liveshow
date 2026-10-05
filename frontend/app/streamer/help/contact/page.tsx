"use client";

import { Suspense } from "react";
import StreamerShell from "@/components/StreamerShell";
import StreamerReportForm from "@/components/StreamerReportForm";
import { StreamerGateNotice, useStreamerGate } from "@/lib/useStreamerGate";

export default function StreamerHelpContactPage() {
    const gate = useStreamerGate();
    if (!gate.ok) return <StreamerGateNotice reason={gate.reason} />;

    return (
        <StreamerShell title="Kapcsolat / Hibabejelentés">
            <p className="mb-6 max-w-2xl text-sm text-neutral-400">
                Írd le a hibát. A név és az email a tartalomkészítő fiókodból megy, nem kell újra megadni.
            </p>
            <Suspense fallback={<p className="text-neutral-400">Betöltés...</p>}>
                <StreamerReportForm />
            </Suspense>
        </StreamerShell>
    );
}
