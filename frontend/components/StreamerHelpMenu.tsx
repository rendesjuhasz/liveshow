"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { usePathname } from "next/navigation";

const ITEMS = [
    { href: "/streamer/help/faq", label: "Gyakori kérdések" },
    { href: "/streamer/help/contact", label: "Kapcsolat / Hibabejelentés" },
    { href: "/streamer/help/guide", label: "Platform útmutató" },
];

export default function StreamerHelpMenu() {
    const pathname = usePathname() || "";
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const helpActive = pathname.startsWith("/streamer/help");

    useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (!root.current?.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    return (
        <div ref={root} className="relative shrink-0">
            <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold shadow-md ${
                    helpActive
                        ? "bg-primary text-[#0b1220]"
                        : "bg-card text-white hover:shadow-[0_8px_24px_rgba(77,203,255,0.15)]"
                }`}
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((v) => !v)}
            >
                <CircleHelp className="size-4" aria-hidden />
                Segítség
            </button>
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 min-w-64 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 py-1 shadow-xl"
                >
                    {ITEMS.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            role="menuitem"
                            className="block px-4 py-2.5 text-sm text-white hover:bg-white/10"
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
