export type AccessFeature = "live" | "archive" | "questions" | "extras" | "privateStream";

export type TicketAccess = {
    live: boolean;
    archive: boolean;
    questions: boolean;
    extras: boolean;
    privateStream: boolean;
};
