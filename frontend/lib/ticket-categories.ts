export const TICKET_CATEGORY_KEYS = ["nezo", "interaktiv", "vip"] as const;

export type TicketCategoryKey = (typeof TICKET_CATEGORY_KEYS)[number];

export const TICKET_CATEGORY_LABELS: Record<string, string> = {
    nezo: "Néző jegy",
    interaktiv: "Interaktív jegy",
    vip: "VIP jegy",
};

export function ticketCategoryLabel(key?: string | null) {
    if (!key) return "Jegy";
    return TICKET_CATEGORY_LABELS[key] || key;
}
