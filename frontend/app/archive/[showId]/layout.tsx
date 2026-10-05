import type { ReactNode } from "react";
import { paramId, routeMetadata } from "@/lib/route-metadata";

export async function generateMetadata({ params }: { params: Promise<{ showId: string }> }) {
    const { showId } = await params;
    return routeMetadata(`/archive/${paramId(showId)}`);
}

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
