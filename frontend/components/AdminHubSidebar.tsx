"use client";

import Link from "next/link";
import { ADMIN_MENUS } from "@/lib/admin-menus";

export default function AdminHubSidebar() {
    return (
        <aside className="border-b border-white/10 bg-gray-950 md:w-72 md:shrink-0 md:border-b-0 md:border-r md:sticky md:top-0 md:h-dvh md:overflow-y-auto">
            <div className="p-4">
                <p className="text-sm font-semibold text-yellow-300">Admin</p>
                <p className="mt-1 text-xs text-zinc-500">
                    Válassz menüt — utána teljes képernyőn nyílik.
                </p>
            </div>
            <nav className="px-2 pb-6">
                {ADMIN_MENUS.filter((item) => item.href !== "/admin").map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="mb-1 block rounded-lg px-3 py-2 hover:bg-white/5"
                    >
                        <span className="block text-sm font-medium">{item.title}</span>
                        <span
                            className="mt-0.5 block text-[11px] leading-snug text-zinc-400"
                            suppressHydrationWarning
                        >
                            {item.canDo}
                        </span>
                    </Link>
                ))}
            </nav>
        </aside>
    );
}
