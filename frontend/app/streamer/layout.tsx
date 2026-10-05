import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/route-metadata";
import StreamerArea from "@/components/StreamerArea";

export function generateMetadata() {
    return routeMetadata("/streamer");
}

export default function Layout({ children }: { children: ReactNode }) {
    return <StreamerArea>{children}</StreamerArea>;
}
