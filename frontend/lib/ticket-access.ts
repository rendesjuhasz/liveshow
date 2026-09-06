export type AccessFeature = "live" | "archive" | "questions" | "extras" | "privateStream";

export type TicketAccess = {
    live: boolean;
    archive: boolean;
    questions: boolean;
    extras: boolean;
    privateStream: boolean;
};

export function accessForCategory(key?: string | null, paid = false): TicketAccess {
    if (!paid) {
        return { live: false, archive: false, questions: false, extras: false, privateStream: false };
    }
    if (key === "vip") {
        return { live: true, archive: true, questions: true, extras: true, privateStream: true };
    }
    if (key === "interaktiv") {
        return { live: true, archive: true, questions: true, extras: false, privateStream: false };
    }
    return { live: true, archive: true, questions: false, extras: false, privateStream: false };
}
