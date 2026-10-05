export const PROTECTED_PACK_STATUSES = ["paid", "refunded"] as const;
export const REFUND_SPEND_REASON = "refunded";
export const QUESTION_HOLD_REASON = "question_hold";

export function isProtectedPackStatus(status?: string | null) {
    const value = String(status || "").trim().toLowerCase();
    return value === "paid" || value === "refunded";
}

export function canDemotePackOnPaymentFailure(packStatus?: string | null) {
    return !isProtectedPackStatus(packStatus);
}

export function spendCountsTowardPayout(reason?: string | null) {
    const value = String(reason || "").trim().toLowerCase();
    return value !== REFUND_SPEND_REASON && value !== QUESTION_HOLD_REASON;
}

export function isLocalRefundedStatus(status?: string | null) {
    return String(status || "").trim().toLowerCase() === "refunded";
}

/** Paid and refunded rows must not go through fulfillPaidRecord. */
export function shouldFulfillConfirmStripe(localStatus?: string | null) {
    const value = String(localStatus || "").trim().toLowerCase();
    return value !== "paid" && value !== "refunded";
}

export function isBarionRefundStatus(status?: string | null) {
    const value = String(status || "").trim().toLowerCase();
    return value === "refunded" || value === "partiallyrefunded";
}

export function canActivateFromBarion(localStatus?: string | null, barionStatus?: string | null) {
    if (isLocalRefundedStatus(localStatus)) return false;
    if (isBarionRefundStatus(barionStatus)) return false;
    return String(barionStatus || "").trim() === "Succeeded";
}

/** True only when the Stripe object proves the whole charge was refunded. */
export function stripeObjectFullyRefunded(type: string, obj: Record<string, unknown>) {
    if (type === "charge.refunded") {
        if (obj.refunded === true) return true;
        const amount = Number(obj.amount);
        const refunded = Number(obj.amount_refunded);
        return Number.isFinite(amount) && amount > 0 && refunded >= amount;
    }
    if (type === "refund.created" || type === "refund.updated") {
        if (String(obj.status || "") !== "succeeded") return false;
        const charge = obj.charge;
        if (charge && typeof charge === "object") {
            const row = charge as Record<string, unknown>;
            if (row.refunded === true) return true;
            const amount = Number(row.amount);
            const refunded = Number(row.amount_refunded);
            return Number.isFinite(amount) && amount > 0 && refunded >= amount;
        }
        return false;
    }
    return false;
}
