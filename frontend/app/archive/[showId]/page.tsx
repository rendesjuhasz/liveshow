"use client";

import { useParams } from "next/navigation";
import ArchiveWatchFeed from "@/components/archive/ArchiveWatchFeed";

export default function ArchiveWatchPage() {
    const { showId } = useParams<{ showId: string }>();
    const id = decodeURIComponent(String(Array.isArray(showId) ? showId[0] : showId ?? "")).trim();
    if (!id) return null;
    return <ArchiveWatchFeed initialId={id} />;
}
