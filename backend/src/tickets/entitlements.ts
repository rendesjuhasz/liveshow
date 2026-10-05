export type AccessFeature = "live" | "archive" | "questions" | "extras" | "privateStream";

export type TicketAccess = {
    live: boolean;
    archive: boolean;
    questions: boolean;
    extras: boolean;
    privateStream: boolean;
};

export const NO_ACCESS: TicketAccess = {
    live: false,
    archive: false,
    questions: false,
    extras: false,
    privateStream: false,
};

export const ADMIN_ACCESS: TicketAccess = {
    live: true,
    archive: true,
    questions: true,
    extras: true,
    privateStream: true,
};

export function publicWatchAccess(canAsk: boolean): TicketAccess {
    return {
        live: true,
        archive: true,
        questions: canAsk,
        extras: false,
        privateStream: false,
    };
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
