import { BadRequestException } from "@nestjs/common";

export const CONTACT_STATUSES = ["new", "opened", "replied"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_PAGE_SIZES = [25, 50] as const;

export function isContactStatus(value: string): value is ContactStatus {
    return (CONTACT_STATUSES as readonly string[]).includes(value);
}

export function parseContactStatusFilter(raw?: string | null): ContactStatus | "all" {
    const s = String(raw ?? "all").trim().toLowerCase();
    if (!s || s === "all") return "all";
    if (isContactStatus(s)) return s;
    throw new BadRequestException("Érvénytelen státuszszűrő.");
}

export function parseContactStatusValue(raw?: string | null): ContactStatus {
    const s = String(raw ?? "").trim().toLowerCase();
    if (isContactStatus(s)) return s;
    throw new BadRequestException("Érvénytelen státusz.");
}

export function parseContactPaging(pageRaw?: unknown, pageSizeRaw?: unknown) {
    const page = Math.max(1, Number.parseInt(String(pageRaw ?? "1"), 10) || 1);
    const requested = Number.parseInt(String(pageSizeRaw ?? "25"), 10) || 25;
    const pageSize = (CONTACT_PAGE_SIZES as readonly number[]).includes(requested) ? requested : 25;
    return { page, pageSize, skip: (page - 1) * pageSize };
}

export function likePattern(q: string) {
    const safe = q.replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim();
    return `%${safe}%`;
}

export function messagePreview(message: string, max = 140) {
    const t = String(message || "").replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
}
