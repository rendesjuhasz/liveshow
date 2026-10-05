import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/route-metadata";
import { FAQ_REVALIDATE } from "@/lib/page-cache";

export const revalidate = FAQ_REVALIDATE;

export function generateMetadata() {
    return routeMetadata("/faq");
}

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
