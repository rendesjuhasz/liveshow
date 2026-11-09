import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/route-metadata";

/** ISR seconds; keep in sync with LEGAL_REVALIDATE in lib/page-cache.ts */
export const revalidate = 86_400;

export function generateMetadata() {
    return routeMetadata("/cookie-tajekoztato");
}

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
