import { ApiError } from "@/api/auth-storage";

export type ShowFieldKey =
    | "title"
    | "description"
    | "videoCategory"
    | "startTime"
    | "endTime"
    | "timezone"
    | "streamId";

export type ShowFieldErrors = Partial<Record<ShowFieldKey, string>>;

export const SHOW_FIELD_IDS: Record<ShowFieldKey, string> = {
    title: "show-title",
    description: "show-description",
    videoCategory: "show-video-category",
    startTime: "show-start-date",
    endTime: "show-end-date",
    timezone: "show-timezone",
    streamId: "show-stream-id",
};

const SHOW_FIELD_ORDER: ShowFieldKey[] = [
    "title",
    "videoCategory",
    "description",
    "startTime",
    "endTime",
    "timezone",
    "streamId",
];

const API_FIELD_ALIAS: Record<string, ShowFieldKey> = {
    title: "title",
    description: "description",
    videoCategory: "videoCategory",
    startTime: "startTime",
    startLocal: "startTime",
    startAtUtc: "startTime",
    endTime: "endTime",
    endLocal: "endTime",
    endAtUtc: "endTime",
    timezone: "timezone",
    streamId: "streamId",
};

export function focusFirstShowFieldError(errors: ShowFieldErrors) {
    if (typeof document === "undefined") return;
    const key = SHOW_FIELD_ORDER.find((name) => errors[name]);
    if (!key) return;
    const el = document.getElementById(SHOW_FIELD_IDS[key]);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    if ("focus" in el && typeof (el as HTMLElement).focus === "function") {
        (el as HTMLElement).focus();
    }
}

export function splitApiFormError(err: unknown): { fieldErrors: ShowFieldErrors; formError: string } {
    const api = err as ApiError & { fields?: Record<string, string> };
    const fieldErrors: ShowFieldErrors = {};
    const leftover: string[] = [];
    const rawFields = api?.fields && typeof api.fields === "object" ? api.fields : null;
    if (rawFields) {
        for (const [key, value] of Object.entries(rawFields)) {
            const mapped = API_FIELD_ALIAS[key];
            const text = String(value || "").trim();
            if (mapped && text) fieldErrors[mapped] = text;
            else if (text) leftover.push(text);
        }
    }
    if (Object.keys(fieldErrors).length) {
        return { fieldErrors, formError: leftover.join(" ") };
    }
    const message = err instanceof Error ? err.message : "";
    return { fieldErrors, formError: leftover.join(" ") || message };
}
