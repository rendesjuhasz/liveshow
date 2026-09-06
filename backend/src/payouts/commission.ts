export const DEFAULT_COMMISSION_PERCENT = 20;
export const PAYOUT_STATUSES = ["pending", "approved", "paid", "rejected"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export function isPayoutStatus(value: string): value is PayoutStatus {
    return (PAYOUT_STATUSES as readonly string[]).includes(value);
}

export function splitRevenue(gross: number, commissionPercent: number) {
    const safeGross = Math.max(0, Math.round(Number(gross) || 0));
    const rate = Math.min(90, Math.max(0, Math.round(Number(commissionPercent) || 0)));
    const commission = Math.round((safeGross * rate) / 100);
    const net = Math.max(0, safeGross - commission);
    return {
        gross: safeGross,
        commissionPercent: rate,
        commission,
        net,
    };
}

export function payoutStatusLabel(status?: string | null) {
    switch (String(status || "").toLowerCase()) {
        case "approved":
            return "Folyamatban";
        case "paid":
            return "Kifizetve";
        case "rejected":
            return "Elutasítva";
        default:
            return "Függőben";
    }
}
