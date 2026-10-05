export type StreamAlert = {
    id: string;
    streamId: string;
    showId?: string | null;
    severity: "info" | "warning" | "critical" | string;
    type: string;
    title: string;
    message: string;
    recommendation: string;
    createdAt: string;
    resolvedAt?: string | null;
    snoozedUntil?: string | null;
    active?: boolean;
};
