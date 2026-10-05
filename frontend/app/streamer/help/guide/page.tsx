"use client";

import StreamerShell from "@/components/StreamerShell";
import StreamerHandbook from "@/components/StreamerHandbook";
import { StreamerGateNotice, useStreamerGate } from "@/lib/useStreamerGate";

export default function StreamerHelpGuidePage() {
    const gate = useStreamerGate();
    if (!gate.ok) return <StreamerGateNotice reason={gate.reason} />;

    return (
        <StreamerShell title="Tartalomkészítő Kézikönyv">
            <StreamerHandbook />
        </StreamerShell>
    );
}
