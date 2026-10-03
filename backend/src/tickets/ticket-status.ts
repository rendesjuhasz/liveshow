export const TICKET_STATUSES = {
    PENDING_PAYMENT: "pending",
    PAID: "paid",
    FAILED: "failed",
    CANCELLED: "cancelled",
    REFUNDED: "refunded",
    ACTIVE: "active",
    USED: "used",
} as const;

/** Fizetett / aktivált jegyek — interakció, bevétel, emlékeztető */
export const FULFILLED_TICKET_STATUSES = [
    TICKET_STATUSES.PAID,
    TICKET_STATUSES.ACTIVE,
] as const;

export function isTicketActive(status?: string | null) {
    const value = String(status || "").trim().toLowerCase();
    return value === TICKET_STATUSES.PAID || value === TICKET_STATUSES.ACTIVE;
}

export function ticketStatusLabelHu(status?: string | null) {
    switch (String(status || "").trim().toLowerCase()) {
        case "pending":
            return "Fizetésre vár";
        case "paid":
            return "Fizetve";
        case "failed":
            return "Sikertelen fizetés";
        case "cancelled":
            return "Megszakítva";
        case "refunded":
            return "Visszatérítve";
        case "active":
            return "Aktív jegy";
        case "used":
            return "Felhasználva";
        default:
            return status || "-";
    }
}
