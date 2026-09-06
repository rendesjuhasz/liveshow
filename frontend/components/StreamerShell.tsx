"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
    { href: "/streamer", label: "Áttekintés" },
    { href: "/streamer/shows", label: "Saját műsorok" },
    { href: "/streamer/live", label: "Élő adás" },
    { href: "/streamer/revenue", label: "Bevételek" },
    { href: "/streamer/payouts", label: "Kifizetések" },
    { href: "/streamer/leaderboard", label: "Ranglista" },
    { href: "/streamer/reviews", label: "Értékelések" },
    { href: "/streamer/questions", label: "Aktuális kérdés" },
    { href: "/streamer/wishes", label: "Kívánságfal" },
    { href: "/streamer/private-requests", label: "Privát kívánságok" },
];

export default function StreamerShell({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className="min-h-dvh bg-background text-white">
            <div className="mx-auto max-w-6xl p-4 md:p-8">
                <p className="text-sm text-yellow-400 mb-1">Streamer felület</p>
                <p className="mb-4 text-xs text-neutral-500">
                    Ez az ablak maradjon a streameré. Néző: másik böngésző vagy privát ablak,
                    nézői belépés új emaillel.
                </p>
                <h1 className="mb-6 text-2xl font-bold md:text-3xl">{title}</h1>
                <nav className="hide-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1">
                    {LINKS.map((link) => {
                        const active =
                            link.href === "/streamer"
                                ? pathname === "/streamer"
                                : link.href === "/streamer/shows"
                                  ? pathname.startsWith("/streamer/shows") ||
                                    pathname.startsWith("/streamer/vod")
                                  : pathname === link.href || pathname.startsWith(link.href);
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`shrink-0 px-3 py-2.5 rounded-lg text-sm ${
                                    active
                                        ? "bg-yellow-500 text-black font-semibold"
                                        : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                                }`}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>
                {children}
            </div>
        </div>
    );
}
