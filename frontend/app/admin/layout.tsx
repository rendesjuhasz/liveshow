import type { ReactNode } from "react";
import { routeMetadata } from "@/lib/route-metadata";
import AdminAccessGate from "@/components/AdminAccessGate";
import { requireAdminPage } from "@/lib/server-admin";
import { headers } from "next/headers";
import { isAdminLoginPath } from "@/lib/admin-session";

export function generateMetadata() {
    return routeMetadata("/admin");
}

export default async function Layout({ children }: { children: ReactNode }) {
    const h = await headers();
    const path = h.get("x-liveshow-path") || "";
    if (isAdminLoginPath(path)) {
        return <>{children}</>;
    }
    await requireAdminPage();
    return (
        <AdminAccessGate>{children}</AdminAccessGate>
    );
}
