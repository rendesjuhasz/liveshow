"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { TICKET_GROUPS } from "@/lib/ticket-groups";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/I18nProvider";

type Pack = {
    key: string;
    name: string;
    ticketCount: number;
    price: number;
    unitValue: number;
};

export default function TicketPackShop({
    compact = false,
    onBought,
}: {
    compact?: boolean;
    onBought?: () => void;
}) {
    const { user } = useAuth();
    const { t, formatMoney } = useT();
    const router = useRouter();
    const [packs, setPacks] = useState<Pack[]>([...TICKET_GROUPS]);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        apiFetch("/ticket-packs")
            .then((d) => {
                if (Array.isArray(d) && d.length) setPacks(d);
            })
            .catch(() => undefined);
    }, []);

    async function buy(groupKey: string) {
        if (!user) {
            router.push("/login");
            return;
        }
        setError("");
        setMessage("");
        setBusy(groupKey);
        try {
            const data = await apiFetch("/tickets/packs", {
                method: "POST",
                body: JSON.stringify({ groupKey }),
            });
            if (data?.checkoutUrl) {
                window.location.href = data.checkoutUrl;
                return;
            }
            if (data?.devPay && data?.purchaseId) {
                await apiFetch("/payments/confirm-dev", {
                    method: "POST",
                    body: JSON.stringify({ packPurchaseId: data.purchaseId }),
                });
                setMessage("A csomag aktív. A jegyek hozzáadódtak az egyenlegedhez.");
                onBought?.();
                return;
            }
            setMessage(data?.message || "A csomag fizetésre vár.");
            onBought?.();
        } catch (err: any) {
            setError(err.message || "A csomag vásárlása nem sikerült.");
        } finally {
            setBusy("");
        }
    }

    return (
        <div className={compact ? "" : "rounded-2xl border border-white/10 bg-zinc-950/80 p-4 sm:p-6"}>
            <h2 className="mb-1 text-lg font-bold">{t("tickets.packs")}</h2>
            <p className="mb-4 text-sm text-zinc-400">
                {t("tickets.packsHint")}
            </p>
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            {message && <p className="mb-3 text-sm text-emerald-400">{message}</p>}
            <ul className="grid gap-3">
                {packs.map((g) => (
                    <li
                        key={g.key}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3"
                    >
                        <div>
                            <p className="font-semibold">{t(`pack.${g.key}`)}</p>
                            <p className="text-xs text-zinc-400">
                                {g.ticketCount} jegy · {formatMoney(g.price)} · {formatMoney(g.unitValue)}/jegy
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="gold"
                            size="sm"
                            disabled={Boolean(busy)}
                            onClick={() => buy(g.key)}
                        >
                            {busy === g.key ? "..." : t("tickets.buy")}
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
