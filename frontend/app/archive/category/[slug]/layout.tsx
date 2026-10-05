import type { ReactNode } from "react";
import { paramId, routeMetadata } from "@/lib/route-metadata";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    return routeMetadata(`/archive/category/${paramId(slug)}`);
}

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
