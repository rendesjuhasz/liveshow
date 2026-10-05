export const WISH_STATUSES = {
    PENDING: "pending",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    COMPLETED: "completed",
} as const;

export const WISH_VISIBILITY = {
    PUBLIC: "public",
    PRIVATE: "private",
} as const;

export type WishVisibility = (typeof WISH_VISIBILITY)[keyof typeof WISH_VISIBILITY];

export function parseWishVisibility(value?: string): WishVisibility {
    return value === WISH_VISIBILITY.PRIVATE ? WISH_VISIBILITY.PRIVATE : WISH_VISIBILITY.PUBLIC;
}

export type WishStatus = (typeof WISH_STATUSES)[keyof typeof WISH_STATUSES];

export const WISH_XP_REWARD = 50;

export const OTLETGAZDA_BADGE = {
    key: "otletgazda",
    title: "Ötletgazda",
    description: "A tartalomkészítő megvalósította az általad beküldött kívánságot.",
};

export function publicAuthorName(user?: { name?: string | null } | string | null) {
    if (user && typeof user === "object") {
        const name = String(user.name || "").trim();
        if (name) return name.slice(0, 32);
    }
    return "Néző";
}

export function wishStatusLabelHu(status: string) {
    switch (status) {
        case WISH_STATUSES.ACCEPTED:
            return "Elfogadva";
        case WISH_STATUSES.REJECTED:
            return "Elutasítva";
        case WISH_STATUSES.COMPLETED:
            return "Teljesítve";
        default:
            return "Függőben";
    }
}
