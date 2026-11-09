import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/route-metadata";

/** ISR seconds; keep in sync with FAQ_REVALIDATE in lib/page-cache.ts */
export const revalidate = 300;

export function generateMetadata() {
    return routeMetadata("/faq");
}

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
