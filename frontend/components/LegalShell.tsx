import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_PAGES = [
    { href: "/aszf", title: "ÁSZF" },
    { href: "/adatkezeles", title: "Adatkezelési tájékoztató" },
    { href: "/moderalasi-szabalyzat", title: "Moderálási szabályzat" },
    { href: "/jogi-nyilatkozat", title: "Jogi nyilatkozat" },
    { href: "/cookie-tajekoztato", title: "Cookie tájékoztató" },
    { href: "/faq", title: "FAQ" },
    { href: "/kapcsolat", title: "Kapcsolat" },
] as const;

export default function LegalShell({
    title,
    updated,
    children,
}: {
    title: string;
    updated: string;
    children: ReactNode;
}) {
    return (
        <div className="min-h-dvh bg-background px-4 py-10 text-white">
            <article className="max-w-3xl mx-auto">
                <nav className="flex flex-wrap gap-3 text-sm mb-8">
                    {LEGAL_PAGES.map((page) => (
                        <Link
                            key={page.href}
                            href={page.href}
                            className="text-neutral-400 hover:text-yellow-400 underline-offset-2 hover:underline"
                        >
                            {page.title}
                        </Link>
                    ))}
                </nav>
                <h1 className="mb-2 text-2xl font-bold md:text-3xl">{title}</h1>
                <p className="text-sm text-neutral-500 mb-8">Utolsó frissítés: {updated}</p>
                <div className="space-y-4 text-neutral-300 leading-relaxed [&_h2]:text-white [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
                    {children}
                </div>
            </article>
        </div>
    );
}
