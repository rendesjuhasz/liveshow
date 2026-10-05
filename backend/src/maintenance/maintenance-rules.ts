export const MAINTENANCE_SERVICES = [
    "live_stream",
    "hls",
    "chat",
    "tickets",
    "archive_generate",
    "archive_play",
    "login",
    "api",
    "payment",
    "storage",
] as const;

export type MaintenanceServiceId = (typeof MAINTENANCE_SERVICES)[number];

export const MAINTENANCE_KINDS = ["info", "partial", "full", "emergency"] as const;
export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number];

export const MAINTENANCE_STATUSES = ["scheduled", "active", "completed", "cancelled"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const STATUS_COMPONENTS = [
    "live_stream",
    "hls",
    "chat",
    "auth",
    "payment",
    "storage",
    "api",
    "archive",
] as const;

export type StatusComponentId = (typeof STATUS_COMPONENTS)[number];
export type PublicComponentState = "operational" | "maintenance" | "degraded" | "outage";

export const SERVICE_LABELS_HU: Record<MaintenanceServiceId, string> = {
    live_stream: "Live Stream",
    hls: "HLS",
    chat: "Chat",
    tickets: "Jegyvásárlás",
    archive_generate: "Archívum generálás",
    archive_play: "Archivált videók lejátszása",
    login: "Bejelentkezés",
    api: "API",
    payment: "Fizetési rendszer",
    storage: "Fájltárolás",
};

export const KIND_LABELS_HU: Record<MaintenanceKind, string> = {
    info: "Információs",
    partial: "Részleges korlátozás",
    full: "Teljes karbantartási mód",
    emergency: "Vészhelyzeti karbantartás",
};

export type MaintenanceEventLike = {
    status: string;
    kind: string;
    services: string[];
};

export function isMaintenanceService(value: string): value is MaintenanceServiceId {
    return (MAINTENANCE_SERVICES as readonly string[]).includes(value);
}

export function isMaintenanceKind(value: string): value is MaintenanceKind {
    return (MAINTENANCE_KINDS as readonly string[]).includes(value);
}

export function parseServices(raw: unknown): MaintenanceServiceId[] {
    const list = Array.isArray(raw) ? raw : [];
    return [...new Set(list.map((item) => String(item || "").trim()).filter(isMaintenanceService))];
}

export function normalizePath(urlPath: string) {
    let path = String(urlPath || "").split("?")[0] || "/";
    if (path.startsWith("/api/")) path = path.slice(4);
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return path || "/";
}

export function shouldSkipMaintenancePath(path: string, method: string) {
    const p = normalizePath(path);
    const m = String(method || "GET").toUpperCase();
    if (m === "OPTIONS" || m === "HEAD") return true;
    if (p === "/health" || p.startsWith("/health/")) return true;
    if (p === "/status" || p.startsWith("/status/")) return true;
    if (p === "/maintenance/current" || p.startsWith("/maintenance/")) return true;
    if (p.startsWith("/admin")) return true;
    if (p === "/auth/csrf" || p.startsWith("/auth/refresh")) return true;
    if (p.startsWith("/payments/stripe/webhook")) return true;
    if (p.startsWith("/barion") || p.startsWith("/api/barion")) return true;
    if (p.startsWith("/socket.io") || p.startsWith("/live-io")) return true;
    return false;
}

export function blockedServicesForEvent(event: MaintenanceEventLike | null | undefined): MaintenanceServiceId[] {
    if (!event) return [];
    if (String(event.status) !== "active") return [];
    const kind = String(event.kind || "");
    if (kind === "info") return [];
    const selected = parseServices(event.services);
    if ((kind === "full" || kind === "emergency") && selected.length === 0) {
        return [...MAINTENANCE_SERVICES];
    }
    return selected;
}

export function servicesForRequest(path: string, method: string, body?: Record<string, unknown> | null): MaintenanceServiceId[] {
    const p = normalizePath(path);
    const m = String(method || "GET").toUpperCase();
    const hits: MaintenanceServiceId[] = [];

    if (m === "POST" && /\/streamer\/shows\/[^/]+\/live$/.test(p)) {
        if (body && body.live === false) return [];
        hits.push("live_stream");
    }
    if (m === "POST" && p === "/ingest/start") hits.push("live_stream");
    if (m === "POST" && p === "/livekit/token") {
        const role = String(body?.role || "").toLowerCase();
        if (role === "publisher") hits.push("live_stream");
    }

    if (m === "GET" && (p.startsWith("/stream/") || p.startsWith("/output/"))) hits.push("hls");

    if (m === "POST" && /\/shows\/[^/]+\/chat$/.test(p)) hits.push("chat");

    if (m === "POST" && (p === "/tickets/packs" || p === "/tickets/buy")) hits.push("tickets", "payment");
    if (m === "POST" && /\/private-requests\/[^/]+\/checkout$/.test(p)) hits.push("tickets", "payment");
    if (m === "POST" && p.startsWith("/payments/") && !p.includes("webhook") && p !== "/payments/cancel") {
        hits.push("payment");
    }

    if (m === "POST" && (p.startsWith("/archive/generate/") || p.startsWith("/archive/regenerate/"))) {
        hits.push("archive_generate");
    }
    if (m === "GET" && (p.startsWith("/archives/") || /\/archive\//.test(p))) {
        if (!p.includes("/generate")) hits.push("archive_play");
    }

    if (m === "POST" && (p === "/auth/login" || p === "/auth/register" || p === "/auth/register-streamer")) {
        hits.push("login");
    }

    if (m === "POST" && (p === "/streamer/vod" || p.includes("/live-archive") || p === "/auth/profile")) {
        hits.push("storage");
    }
    if (m === "POST" && /\/preflight\//.test(p)) hits.push("storage");

    return hits;
}

export function matchingBlockedService(
    path: string,
    method: string,
    blocked: MaintenanceServiceId[],
    body?: Record<string, unknown> | null,
): MaintenanceServiceId | null {
    if (shouldSkipMaintenancePath(path, method)) return null;
    const set = new Set(blocked);
    if (!set.size) return null;
    for (const service of servicesForRequest(path, method, body)) {
        if (set.has(service)) return service;
    }
    const m = String(method || "GET").toUpperCase();
    if (set.has("api") && m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
        return "api";
    }
    return null;
}

export function composeComponentState(opts: {
    maintenance: boolean;
    health: "ok" | "error" | "skip" | string;
}): PublicComponentState {
    if (opts.health === "error") return "outage";
    if (opts.maintenance) return "maintenance";
    if (opts.health === "skip") return "degraded";
    return "operational";
}

export function noticeDue(startsAt: Date, now: Date, windowMs: number, alreadySent: boolean) {
    if (alreadySent) return false;
    const start = startsAt.getTime();
    const t = now.getTime();
    if (start <= t) return false;
    return start - t <= windowMs;
}

export const NOTICE_WINDOWS_MS = {
    h24: 24 * 3600_000,
    h1: 3600_000,
    m10: 10 * 60_000,
} as const;
