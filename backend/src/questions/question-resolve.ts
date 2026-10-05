export const OPEN_QUESTION_STATUSES = ["pending", "approved"] as const;

export type OpenQuestionStatus = (typeof OPEN_QUESTION_STATUSES)[number];
export type ClusterResolveStatus = "fulfilled" | "rejected";

export type LockedQuestion = {
    id: string;
    status?: string | null;
    userId?: string | null;
};

export function isOpenQuestionStatus(status?: string | null) {
    const value = String(status || "").trim().toLowerCase();
    return value === "pending" || value === "approved";
}

export function planClusterResolution(
    lockedRows: LockedQuestion[],
    _next: ClusterResolveStatus,
) {
    const open = lockedRows.filter((row) => isOpenQuestionStatus(row.status));
    if (!open.length) {
        return { noop: true as const, ids: [] as string[], userIds: [] as string[] };
    }
    return {
        noop: false as const,
        ids: open.map((row) => String(row.id)),
        userIds: [...new Set(open.map((row) => String(row.userId || "")).filter(Boolean))],
    };
}
