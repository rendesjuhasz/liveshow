/** Viewer-facing gift lines. Cap is not a balance: hide when the wallet has no gifts. */
export function giftTicketLines(giftBalance: number, giftSpendsRemaining: number) {
    const gifts = Math.max(0, Math.round(Number(giftBalance) || 0));
    if (gifts < 1) return null;
    const capLeft = Math.max(0, Math.round(Number(giftSpendsRemaining) || 0));
    return {
        giftBalance: gifts,
        usableOnThisShow: Math.min(gifts, capLeft),
    };
}
