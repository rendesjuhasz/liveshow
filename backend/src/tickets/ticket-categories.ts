export const TICKET_CATEGORY_KEYS = ["nezo", "interaktiv", "vip"] as const;

export type TicketCategoryKey = (typeof TICKET_CATEGORY_KEYS)[number];

export function isTicketCategoryKey(value: string): value is TicketCategoryKey {
    return (TICKET_CATEGORY_KEYS as readonly string[]).includes(value);
}

export function canAskQuestions(categoryKey?: string | null) {
    return categoryKey === "interaktiv" || categoryKey === "vip";
}

export function ticketCategoryDb(prisma: { ticketCategory?: any } | any) {
    return prisma.ticketCategory;
}

export function showTicketOfferDb(prisma: { showTicketOffer?: any } | any) {
    return prisma.showTicketOffer;
}
