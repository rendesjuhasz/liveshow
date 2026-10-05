"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_MENUS, adminMenuForPath } from "@/lib/admin-menus";

function isActive(href: string, pathname: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() || "";
    const skip =
        pathname === "/admin" ||
        pathname === "/admin/login" ||
        pathname.startsWith("/admin/login/");
    const current = adminMenuForPath(pathname);

    if (skip) {
        return children;
    }

    return (
        <div className="min-h-dvh bg-gray-900 text-white">
            <header className="sticky top-0 z-20 border-b border-white/10 bg-gray-950">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-8">
                    <Link
                        href="/admin"
                        className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/15"
                    >
                        ← Összes menü
                    </Link>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold">{current?.title || "Admin"}</p>
                        {current?.canDo && (
                            <p className="mt-0.5 text-sm leading-snug text-zinc-400">{current.canDo}</p>
                        )}
                    </div>
                    <details className="relative">
                        <summary className="cursor-pointer list-none rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15">
                            Másik menü
                        </summary>
                        <div className="absolute right-0 z-30 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-white/10 bg-gray-900 p-2 shadow-xl">
                            {ADMIN_MENUS.filter((item) => item.href !== "/admin").map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`block rounded-lg px-3 py-2 text-sm ${
                                        isActive(item.href, pathname)
                                            ? "bg-yellow-500/15 text-yellow-200"
                                            : "hover:bg-white/5"
                                    }`}
                                >
                                    {item.title}
                                </Link>
                            ))}
                        </div>
                    </details>
                </div>
            </header>
            {children}
        </div>
    );
}
