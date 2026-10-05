import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/route-metadata";
import { LEGAL_REVALIDATE } from "@/lib/page-cache";

export const revalidate = LEGAL_REVALIDATE;

export function generateMetadata() {
    return routeMetadata("/aszf");
}

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
