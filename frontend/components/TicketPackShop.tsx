"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/api/http";
import { useAuth } from "@/context/AuthContext";
import { TICKET_GROUPS } from "@/lib/ticket-groups";
import { viewerLoginHref } from "@/lib/auth-return";
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
    const { user, status } = useAuth();
    const { t, formatMoney } = useT();
    const router = useRouter();
    const pathname = usePathname();
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
        if (status !== "authenticated" || !user) {
            if (status === "loading") return;
            router.push(viewerLoginHref(pathname || "/"));
            return;
        }
        if (user.emailVerified === false) {
            setError(t("tickets.verifyEmail"));
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
            if (process.env.NODE_ENV !== "production" && data?.devPay && data?.purchaseId) {
                await apiFetch("/payments/confirm-dev", {
                    method: "POST",
                    body: JSON.stringify({ packPurchaseId: data.purchaseId }),
                });
                setMessage(t("tickets.packActive"));
                onBought?.();
                return;
            }
            setMessage(data?.message || t("tickets.packPending"));
            onBought?.();
        } catch (err: any) {
            setError(err.message || t("tickets.packFailed"));
        } finally {
            setBusy("");
        }
    }

    return (
        <div className={compact ? "" : "rounded-2xl bg-card p-4 shadow-[0_10px_28px_rgba(0,0,0,0.35)] sm:p-6"}>
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
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-4 py-3 shadow-md transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(77,203,255,0.15)]"
                    >
                        <div>
                            <p className="font-semibold">{t(`pack.${g.key}`)}</p>
                            <p className="text-xs text-zinc-400">
                                {g.ticketCount} {t("tickets.unit")} · {formatMoney(g.price)} · {formatMoney(g.unitValue)}/{t("tickets.unit")}
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
