import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/route-metadata";
import { CONTACT_REVALIDATE } from "@/lib/page-cache";

export const revalidate = CONTACT_REVALIDATE;

export function generateMetadata() {
    return routeMetadata("/kapcsolat");
}

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
