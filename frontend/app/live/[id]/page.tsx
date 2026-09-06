"use client";

import { useParams } from "next/navigation";
import { isPlaceholderStreamId } from "@/lib/getStreamToken";
import LiveViewer from "./LiveViewer";

export default function LivePage() {
    const { id } = useParams<{ id: string }>();
    const showId = decodeURIComponent(id ?? "").trim();

    if (!showId || isPlaceholderStreamId(showId)) {
        return (
            <div className="p-10 text-white">
                <h1>Élő adás</h1>
                <p>Érvénytelen műsor azonosító.</p>
            </div>
        );
    }

    return <LiveViewer showId={showId} />;
}
