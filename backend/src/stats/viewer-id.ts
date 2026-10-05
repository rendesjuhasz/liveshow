import { randomUUID } from "crypto";

const GUEST_KEY = /^[a-zA-Z0-9_-]{8,64}$/;

function randomGuestSuffix() {
    return randomUUID().replace(/-/g, "").slice(0, 32);
}

export function guestViewerId(raw?: string | null) {
    const value = String(raw || "").trim();
    if (GUEST_KEY.test(value)) return `guest:${value}`;
    return `guest:${randomGuestSuffix()}`;
}
