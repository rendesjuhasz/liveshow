"use client";

import TicketPackShop from "@/components/TicketPackShop";

export default function TicketsPage() {
    return (
        <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10 text-white md:px-8">
            <h1 className="text-3xl font-bold">Jegycsomagok</h1>
            <p className="mt-3 text-sm text-zinc-400">
                Az élő adás és a visszanézés ingyenes. A jegy a kérdésekhez, értékeléshez és a
                prémium interakciókhoz kell.
            </p>
            <div className="mt-8">
                <TicketPackShop />
            </div>
        </div>
    );
}
