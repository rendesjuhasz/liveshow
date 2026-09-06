import type { TicketCategoryKey } from "./ticket-categories";

export type AccessFeature = "live" | "archive" | "questions" | "extras" | "privateStream";

export type TicketAccess = {
    live: boolean;
    archive: boolean;
    questions: boolean;
    extras: boolean;
    privateStream: boolean;
};

const NONE: TicketAccess = {
    live: false,
    archive: false,
    questions: false,
    extras: false,
    privateStream: false,
};

export function accessForCategory(key?: string | null, paid = false): TicketAccess {
    if (!paid) return { ...NONE };
    if (key === "vip") {
        return { live: true, archive: true, questions: true, extras: true, privateStream: true };
    }
    if (key === "interaktiv") {
        return { live: true, archive: true, questions: true, extras: false, privateStream: false };
    }
    if (key === "nezo") {
        return { live: true, archive: true, questions: false, extras: false, privateStream: false };
    }
    return { live: true, archive: true, questions: false, extras: false, privateStream: false };
}

export function hasFeature(access: TicketAccess, feature: AccessFeature) {
    return Boolean(access[feature]);
}

export function featureLabel(feature: AccessFeature) {
    switch (feature) {
        case "live":
            return "élő adás (ingyenes megtekintés)";
        case "archive":
            return "archívum (ingyenes megtekintés)";
        case "questions":
            return "kérdésbeküldés";
        case "extras":
            return "extra tartalmak";
        case "privateStream":
            return "privát stream";
        default:
            return feature;
    }
}

export type { TicketCategoryKey };
