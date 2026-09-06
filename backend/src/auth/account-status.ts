export const USER_ACCOUNT_STATUSES = ["active", "banned"] as const;

export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export function isUserAccountStatus(value: string): value is UserAccountStatus {
    return (USER_ACCOUNT_STATUSES as readonly string[]).includes(value);
}

export function isBannedAccount(status?: string | null) {
    return String(status || "").trim().toLowerCase() === "banned";
}
