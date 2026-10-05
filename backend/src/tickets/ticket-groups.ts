export const TICKET_GROUPS = [
    { key: "alap", name: "Alap", ticketCount: 1, price: 100, unitValue: 100 },
    { key: "ezust", name: "Ezüst", ticketCount: 10, price: 900, unitValue: 90 },
    { key: "arany", name: "Arany", ticketCount: 50, price: 4000, unitValue: 80 },
    { key: "gyemant", name: "Gyémánt", ticketCount: 100, price: 7000, unitValue: 70 },
] as const;

export type TicketGroupKey = (typeof TICKET_GROUPS)[number]["key"];

export function ticketGroupByKey(key?: string | null) {
    const value = String(key || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    return TICKET_GROUPS.find((g) => g.key === value) || null;
}

export function emptyGroupStats(): {
    key: string;
    name: string;
    ticketsSpent: number;
    creditedAmount: number;
    giftTicketsSpent: number;
    unitValue: number;
}[] {
    return TICKET_GROUPS.map((g) => ({
        key: g.key,
        name: g.name,
        ticketsSpent: 0,
        creditedAmount: 0,
        giftTicketsSpent: 0,
        unitValue: g.unitValue,
    }));
}

/** Max free tickets a viewer may spend on a single show (questions, support, reviews). */
export const MAX_GIFT_SPENDS_PER_SHOW = 5;

export function isGiftPack(row: {
    source?: string | null;
    groupKey?: string | null;
    unitValue?: number | null;
}): boolean {
    if (String(row.groupKey || "") === "gift") return true;
    if (String(row.source || "purchase") !== "purchase") return true;
    const unit = Number(row.unitValue);
    return Number.isFinite(unit) && unit <= 0;
}

export function giftSpendAmount(unitValue: number | null | undefined, gift: boolean) {
    if (gift) return 0;
    const unit = Number(unitValue);
    return Number.isFinite(unit) && unit > 0 ? unit : 0;
}
