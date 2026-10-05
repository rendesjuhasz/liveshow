import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/route-metadata";

export function generateMetadata() {
    return routeMetadata("/archive");
}

export default function Layout({ children }: { children: ReactNode }) {
    return children;
}
