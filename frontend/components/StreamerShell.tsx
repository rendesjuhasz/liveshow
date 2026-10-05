"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import StreamerHelpMenu from "@/components/StreamerHelpMenu";
import StreamerMaintenanceNotice from "@/components/StreamerMaintenanceNotice";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; children: NavLink[] };
type NavItem = NavLink | NavGroup;

const CHECK_LINKS: NavLink[] = [
    { href: "/streamer/preflight", label: "Adás előtt" },
    { href: "/streamer/alerts", label: "Riasztások" },
];

const LINKS: NavItem[] = [
    { href: "/streamer", label: "Áttekintés" },
    { href: "/streamer/shows", label: "Saját műsorok" },
    { href: "/streamer/live", label: "Élő adás" },
    { label: "Ellenőrzés", children: CHECK_LINKS },
    { href: "/streamer/revenue", label: "Bevételek" },
    { href: "/streamer/payouts", label: "Kifizetések" },
    { href: "/streamer/leaderboard", label: "Ranglista" },
    { href: "/streamer/reviews", label: "Értékelések" },
    { href: "/streamer/moderation", label: "Moderálás" },
    { href: "/streamer/wishes", label: "Kívánságfal" },
    { href: "/streamer/private-requests", label: "Privát kívánságok" },
];

function isGroup(item: NavItem): item is NavGroup {
    return "children" in item;
}

function pathMatches(href: string, pathname: string) {
    if (href === "/streamer") return pathname === "/streamer";
    if (href === "/streamer/shows") {
        return pathname.startsWith("/streamer/shows") || pathname.startsWith("/streamer/vod");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
}

function groupActive(item: NavGroup, pathname: string) {
    return item.children.some((child) => pathMatches(child.href, pathname));
}

function groupHref(item: NavGroup, pathname: string) {
    return item.children.find((child) => pathMatches(child.href, pathname))?.href || item.children[0].href;
}

function chipClass(active: boolean) {
    return `shrink-0 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
        active
            ? "bg-primary font-semibold text-[#0b1220] shadow-[0_6px_18px_rgba(0,194,255,0.22)]"
            : "bg-card text-muted shadow-md hover:shadow-[0_8px_24px_rgba(77,203,255,0.15)]"
    }`;
}

export default function StreamerShell({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const openGroup = LINKS.find((item): item is NavGroup => isGroup(item) && groupActive(item, pathname));

    return (
        <div className="min-h-dvh bg-background text-white">
            <div className="mx-auto max-w-6xl p-4 md:p-8">
                <div className="mb-6 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm text-accent mb-1">Tartalomkészítő felület</p>
                        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
                    </div>
                    <StreamerHelpMenu />
                </div>
                <StreamerMaintenanceNotice />
                <nav className={`hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 ${openGroup ? "mb-3" : "mb-8"}`}>
                    {LINKS.map((item) => {
                        if (!isGroup(item)) {
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={chipClass(pathMatches(item.href, pathname))}
                                >
                                    {item.label}
                                </Link>
                            );
                        }
                        const active = groupActive(item, pathname);
                        return (
                            <Link
                                key={item.label}
                                href={groupHref(item, pathname)}
                                aria-current={active ? "page" : undefined}
                                className={`${chipClass(active)} inline-flex items-center gap-1`}
                            >
                                {item.label}
                                <ChevronDown className={`size-4 ${active ? "rotate-180" : ""}`} aria-hidden />
                            </Link>
                        );
                    })}
                </nav>
                {openGroup ? (
                    <div className="mb-8 flex flex-wrap gap-2">
                        {openGroup.children.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={chipClass(pathMatches(link.href, pathname))}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                ) : null}
                {children}
            </div>
        </div>
    );
}
