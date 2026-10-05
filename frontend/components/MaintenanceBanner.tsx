"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/api/http";
import { isAdminAppPath, isStreamerAppPath } from "@/lib/roles";
import { usePathname } from "next/navigation";

type Banner = {
    title: string;
    text: string;
    rangeLabel?: string;
    serviceLabels?: string[];
    active?: boolean;
};

export default function MaintenanceBanner() {
    const pathname = usePathname() || "";
    const [banner, setBanner] = useState<Banner | null>(null);

    useEffect(() => {
        if (isAdminAppPath(pathname)) return;
        let stop = false;
        const load = () =>
            apiFetch("/maintenance/current")
                .then((data) => {
                    if (!stop) setBanner(data?.banner || null);
                })
                .catch(() => {
                    if (!stop) setBanner(null);
                });
        void load();
        const t = setInterval(() => void load(), 30_000);
        return () => {
            stop = true;
            clearInterval(t);
        };
    }, [pathname]);

    if (!banner || isAdminAppPath(pathname) || isStreamerAppPath(pathname)) return null;

    return (
        <div className="border-b border-amber-500/40 bg-amber-400 px-4 py-3 text-black">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="font-semibold">{banner.title}</p>
                    <p className="text-sm">
                        {banner.rangeLabel ? `${banner.rangeLabel}. ` : ""}
                        {banner.text}
                    </p>
                </div>
                <Link href="/status" className="shrink-0 text-sm font-medium underline">
                    Rendszerállapot
                </Link>
            </div>
        </div>
    );
}
