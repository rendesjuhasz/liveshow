import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/route-metadata";

/** ISR seconds; keep in sync with CONTACT_REVALIDATE in lib/page-cache.ts */
export const revalidate = 600;

export function generateMetadata() {
    return routeMetadata("/kapcsolat");
}

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
