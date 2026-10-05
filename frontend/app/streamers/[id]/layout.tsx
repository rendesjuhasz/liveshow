import type { ReactNode } from "react";
import { paramId, routeMetadata } from "@/lib/route-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return routeMetadata(`/streamers/${paramId(id)}`);
}

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
