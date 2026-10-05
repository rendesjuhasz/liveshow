import { randomUUID } from "crypto";
import {
    BadRequestException,
    Injectable,
    NotFoundException,
    OnModuleInit,
    ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OpsService } from "../ops/ops.service";
import { isAdminRole } from "../auth/roles";
import {
    blockedServicesForEvent,
    KIND_LABELS_HU,
    matchingBlockedService,
    MAINTENANCE_KINDS,
    MAINTENANCE_SERVICES,
    NOTICE_WINDOWS_MS,
    noticeDue,
    parseServices,
    SERVICE_LABELS_HU,
    STATUS_COMPONENTS,
    composeComponentState,
    type MaintenanceKind,
    type MaintenanceServiceId,
} from "./maintenance-rules";

type Actor = { id?: string; name?: string; role?: string | null };

@Injectable()
export class MaintenanceService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly ops: OpsService,
    ) {}

    async onModuleInit() {
        await this.ensureSchema();
    }

    async ensureSchema() {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "MaintenanceEvent" (
                "id" TEXT PRIMARY KEY,
                "name" TEXT NOT NULL,
                "description" TEXT NOT NULL DEFAULT '',
                "kind" TEXT NOT NULL,
                "status" TEXT NOT NULL,
                "services" TEXT NOT NULL DEFAULT '[]',
                "startsAt" TIMESTAMP(3) NOT NULL,
                "endsAt" TIMESTAMP(3) NOT NULL,
                "createdBy" TEXT,
                "createdByName" TEXT,
                "notify24Sent" BOOLEAN NOT NULL DEFAULT false,
                "notify1Sent" BOOLEAN NOT NULL DEFAULT false,
                "notify10Sent" BOOLEAN NOT NULL DEFAULT false,
                "startedAt" TIMESTAMP(3),
                "completedAt" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "MaintenanceLog" (
                "id" TEXT PRIMARY KEY,
                "eventId" TEXT NOT NULL,
                "action" TEXT NOT NULL,
                "actorUserId" TEXT,
                "actorName" TEXT,
                "services" TEXT NOT NULL DEFAULT '[]',
                "description" TEXT NOT NULL DEFAULT '',
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "MaintenanceEvent_status_starts" ON "MaintenanceEvent" ("status", "startsAt")`,
        ).catch(() => undefined);
    }

    catalog() {
        return {
            services: MAINTENANCE_SERVICES.map((id) => ({ id, label: SERVICE_LABELS_HU[id] })),
            kinds: MAINTENANCE_KINDS.map((id) => ({ id, label: KIND_LABELS_HU[id] })),
        };
    }

    async list(includePast = true) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "MaintenanceEvent"
            ORDER BY "startsAt" DESC
            LIMIT ${includePast ? 80 : 20}
        `.catch(() => []);
        const mapped = rows.map((row) => this.mapEvent(row));
        if (includePast) return mapped;
        return mapped.filter((row) => row.status === "scheduled" || row.status === "active");
    }

    async get(id: string) {
        const row = await this.load(id);
        const logs = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "MaintenanceLog" WHERE "eventId" = ${id} ORDER BY "createdAt" DESC LIMIT 80
        `.catch(() => []);
        return { ...this.mapEvent(row), logs: logs.map((log) => this.mapLog(log)) };
    }

    async create(body: Record<string, unknown>, actor: Actor) {
        const parsed = this.parseBody(body, true);
        const now = new Date();
        const immediate = parsed.startsAt.getTime() <= now.getTime() + 15_000;
        const status = immediate ? "active" : "scheduled";
        const id = randomUUID();
        await this.prisma.$executeRaw`
            INSERT INTO "MaintenanceEvent" (
                id, name, description, kind, status, services, "startsAt", "endsAt",
                "createdBy", "createdByName", "startedAt", "createdAt", "updatedAt"
            ) VALUES (
                ${id}, ${parsed.name}, ${parsed.description}, ${parsed.kind}, ${status},
                ${JSON.stringify(parsed.services)}, ${parsed.startsAt}, ${parsed.endsAt},
                ${actor.id || null}, ${actor.name || null},
                ${status === "active" ? now : null}, ${now}, ${now}
            )
        `;
        await this.log(id, immediate ? "started" : "created", actor, parsed.services, parsed.description);
        return this.get(id);
    }

    async update(id: string, body: Record<string, unknown>, actor: Actor) {
        const current = this.mapEvent(await this.load(id));
        if (current.status === "completed" || current.status === "cancelled") {
            throw new BadRequestException("A lezárt karbantartás nem szerkeszthető.");
        }
        const parsed = this.parseBody({ ...current, ...body }, false);
        await this.prisma.$executeRaw`
            UPDATE "MaintenanceEvent"
            SET name = ${parsed.name},
                description = ${parsed.description},
                kind = ${parsed.kind},
                services = ${JSON.stringify(parsed.services)},
                "startsAt" = ${parsed.startsAt},
                "endsAt" = ${parsed.endsAt},
                "updatedAt" = NOW()
            WHERE id = ${id}
        `;
        await this.log(id, "updated", actor, parsed.services, parsed.description);
        return this.get(id);
    }

    async close(id: string, actor: Actor) {
        const current = this.mapEvent(await this.load(id));
        if (current.status === "completed" || current.status === "cancelled") {
            return this.get(id);
        }
        await this.prisma.$executeRaw`
            UPDATE "MaintenanceEvent"
            SET status = 'completed', "completedAt" = NOW(), "updatedAt" = NOW()
            WHERE id = ${id}
        `;
        await this.log(id, "closed", actor, current.services, "Karbantartás befejezve");
        return this.get(id);
    }

    async currentPublic() {
        await this.tick();
        const now = new Date();
        const active = await this.activeEvent();
        const upcoming = await this.nextScheduled(now);
        const event = active || upcoming;
        const blocked = blockedServicesForEvent(active);
        return {
            active: active ? this.publicEvent(active) : null,
            upcoming: !active && upcoming ? this.publicEvent(upcoming) : null,
            banner: event ? this.banner(event, Boolean(active)) : null,
            blocked,
            liveAffected: blocked.includes("live_stream"),
            streamer: this.streamerNotice(event, blocked),
        };
    }

    async publicStatus() {
        const snapshot = await this.currentPublic();
        const health = await this.ops.ready().catch(() => ({
            status: "error",
            ffmpeg: "error",
            storage: "error",
            db: "error",
            smtp: "skip",
        }));
        const blocked = new Set(snapshot.blocked);
        const healthOf = (key: "ffmpeg" | "storage" | "db" | "status") =>
            String((health as any)[key] || "ok");
        const components = STATUS_COMPONENTS.map((id) => {
            const maint =
                (id === "archive" && (blocked.has("archive_play") || blocked.has("archive_generate"))) ||
                (id === "auth" && blocked.has("login")) ||
                blocked.has(id as MaintenanceServiceId);
            let healthState = "ok";
            if (id === "live_stream" || id === "hls" || id === "archive") healthState = healthOf("ffmpeg");
            if (id === "storage") healthState = healthOf("storage");
            if (id === "api" || id === "auth") healthState = healthOf("db") === "error" ? "error" : healthOf("status");
            return {
                id,
                label: id === "auth" ? "Auth" : id === "archive" ? "Archive" : SERVICE_LABELS_HU[id as MaintenanceServiceId] || id,
                status: composeComponentState({ maintenance: Boolean(maint), health: healthState }),
            };
        });
        const worst = components.some((c) => c.status === "outage")
            ? "outage"
            : components.some((c) => c.status === "maintenance")
              ? "maintenance"
              : components.some((c) => c.status === "degraded")
                ? "degraded"
                : "operational";
        return {
            overall: worst,
            components,
            maintenance: snapshot.banner,
            updatedAt: new Date().toISOString(),
        };
    }

    async assertRequestAllowed(path: string, method: string, body?: Record<string, unknown> | null, actor?: Actor) {
        if (isAdminRole(actor)) return;
        const active = await this.activeEvent();
        const blocked = blockedServicesForEvent(active);
        const hit = matchingBlockedService(path, method, blocked, body);
        if (!hit) return;
        const label = SERVICE_LABELS_HU[hit];
        throw new ServiceUnavailableException({
            statusCode: 503,
            code: "maintenance",
            message: `Karbantartás: a(z) ${label} szolgáltatás jelenleg nem elérhető.`,
            service: hit,
            eventId: active?.id,
        });
    }

    private lastTickAt = 0;

    async tick() {
        const nowMs = Date.now();
        if (nowMs - this.lastTickAt < 4000) return;
        this.lastTickAt = nowMs;
        const now = new Date();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "MaintenanceEvent"
            WHERE status IN ('scheduled', 'active')
            ORDER BY "startsAt" ASC
            LIMIT 40
        `.catch(() => []);
        for (const raw of rows) {
            const event = this.mapEvent(raw);
            if (event.status === "scheduled" && event.startsAt.getTime() <= now.getTime() && event.endsAt.getTime() > now.getTime()) {
                await this.prisma.$executeRaw`
                    UPDATE "MaintenanceEvent"
                    SET status = 'active', "startedAt" = ${now}, "updatedAt" = ${now}
                    WHERE id = ${event.id} AND status = 'scheduled'
                `;
                await this.log(event.id, "started", { name: "system" }, event.services, "Automatikus indítás");
            }
            if (event.status === "active" && event.endsAt.getTime() <= now.getTime()) {
                await this.prisma.$executeRaw`
                    UPDATE "MaintenanceEvent"
                    SET status = 'completed', "completedAt" = ${now}, "updatedAt" = ${now}
                    WHERE id = ${event.id} AND status = 'active'
                `;
                await this.log(event.id, "expired", { name: "system" }, event.services, "Automatikus lezárás");
            }
            await this.maybeNotify(event, now);
        }
    }

    private async maybeNotify(event: ReturnType<MaintenanceService["mapEvent"]>, now: Date) {
        if (event.status !== "scheduled" && event.status !== "active") return;
        if (event.status === "active") return;
        const windows: Array<{ flag: "notify24Sent" | "notify1Sent" | "notify10Sent"; ms: number; action: string }> = [
            { flag: "notify24Sent", ms: NOTICE_WINDOWS_MS.h24, action: "notify_24h" },
            { flag: "notify1Sent", ms: NOTICE_WINDOWS_MS.h1, action: "notify_1h" },
            { flag: "notify10Sent", ms: NOTICE_WINDOWS_MS.m10, action: "notify_10m" },
        ];
        for (const window of windows) {
            if (!noticeDue(event.startsAt, now, window.ms, Boolean(event[window.flag]))) continue;
            if (window.flag === "notify24Sent") {
                await this.prisma.$executeRaw`UPDATE "MaintenanceEvent" SET "notify24Sent" = true, "updatedAt" = NOW() WHERE id = ${event.id}`;
            } else if (window.flag === "notify1Sent") {
                await this.prisma.$executeRaw`UPDATE "MaintenanceEvent" SET "notify1Sent" = true, "updatedAt" = NOW() WHERE id = ${event.id}`;
            } else {
                await this.prisma.$executeRaw`UPDATE "MaintenanceEvent" SET "notify10Sent" = true, "updatedAt" = NOW() WHERE id = ${event.id}`;
            }
            await this.log(event.id, window.action, { name: "system" }, event.services, `Értesítés: ${window.action}`);
            await this.notifyStreamers(event, window.action);
        }
    }

    private async notifyStreamers(event: ReturnType<MaintenanceService["mapEvent"]>, action: string) {
        const streamers = await this.prisma.streamer.findMany({
            where: { status: "approved" },
            select: { userId: true },
            take: 500,
        }).catch(() => []);
        const title = "Tervezett karbantartás";
        const live = event.services.includes("live_stream") || event.kind === "full" || event.kind === "emergency";
        const body = live
            ? `Figyelem. Az élő közvetítés a karbantartás alatt nem indítható. ${this.formatRange(event.startsAt, event.endsAt)}`
            : `Karbantartás várható. Az élő közvetítés nem érintett. ${this.formatRange(event.startsAt, event.endsAt)}`;
        for (const row of streamers) {
            const userId = String(row.userId || "").trim();
            if (!userId) continue;
            await this.prisma.$executeRaw`
                INSERT INTO "UserNotification" (id, "userId", type, title, body, read, "relatedId", "createdAt")
                VALUES (
                    ${randomUUID()},
                    ${userId},
                    'maintenance',
                    ${title},
                    ${body},
                    false,
                    ${event.id},
                    NOW()
                )
            `.catch(() => undefined);
        }
        void action;
    }

    private async activeEvent() {
        const now = new Date();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "MaintenanceEvent"
            WHERE status = 'active' AND "startsAt" <= ${now} AND "endsAt" > ${now}
            ORDER BY "startsAt" DESC
            LIMIT 1
        `.catch(() => []);
        return rows[0] ? this.mapEvent(rows[0]) : null;
    }

    private async nextScheduled(now: Date) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "MaintenanceEvent"
            WHERE status = 'scheduled' AND "endsAt" > ${now}
            ORDER BY "startsAt" ASC
            LIMIT 1
        `.catch(() => []);
        return rows[0] ? this.mapEvent(rows[0]) : null;
    }

    private parseBody(body: Record<string, unknown>, creating: boolean) {
        const name = String(body.name || "").trim();
        const description = String(body.description || "").trim();
        const kind = String(body.kind || "").trim() as MaintenanceKind;
        if (name.length < 3) throw new BadRequestException("A név legalább 3 karakter legyen.");
        if (!MAINTENANCE_KINDS.includes(kind)) throw new BadRequestException("Érvénytelen karbantartás típus.");
        const startsAt = new Date(String(body.startsAt || body.startAt || ""));
        const endsAt = new Date(String(body.endsAt || body.endAt || ""));
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
            throw new BadRequestException("Érvényes kezdés és befejezés kell.");
        }
        if (endsAt.getTime() <= startsAt.getTime()) {
            throw new BadRequestException("A befejezés a kezdés után legyen.");
        }
        if (creating && endsAt.getTime() <= Date.now() - 60_000) {
            throw new BadRequestException("A befejezés nem lehet a múltban.");
        }
        let services = parseServices(body.services);
        if ((kind === "full" || kind === "emergency") && services.length === 0) {
            services = [...MAINTENANCE_SERVICES];
        }
        if (kind === "partial" && services.length === 0) {
            throw new BadRequestException("Részleges karbantartáshoz válassz legalább egy szolgáltatást.");
        }
        return { name, description, kind, startsAt, endsAt, services };
    }

    private async load(id: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "MaintenanceEvent" WHERE id = ${id} LIMIT 1
        `;
        if (!rows[0]) throw new NotFoundException("A karbantartás nem található.");
        return rows[0];
    }

    private async log(
        eventId: string,
        action: string,
        actor: Actor,
        services: string[],
        description: string,
    ) {
        await this.prisma.$executeRaw`
            INSERT INTO "MaintenanceLog" (id, "eventId", action, "actorUserId", "actorName", services, description, "createdAt")
            VALUES (
                ${randomUUID()},
                ${eventId},
                ${action},
                ${actor.id || null},
                ${actor.name || "system"},
                ${JSON.stringify(services)},
                ${description || ""},
                NOW()
            )
        `.catch(() => undefined);
    }

    private mapEvent(row: any) {
        return {
            id: String(row.id),
            name: String(row.name || ""),
            description: String(row.description || ""),
            kind: String(row.kind || "info") as MaintenanceKind,
            status: String(row.status || "scheduled"),
            services: parseServices(this.parseJson(row.services)),
            startsAt: new Date(row.startsAt),
            endsAt: new Date(row.endsAt),
            createdBy: row.createdBy || null,
            createdByName: row.createdByName || null,
            notify24Sent: Boolean(row.notify24Sent),
            notify1Sent: Boolean(row.notify1Sent),
            notify10Sent: Boolean(row.notify10Sent),
            startedAt: row.startedAt ? new Date(row.startedAt) : null,
            completedAt: row.completedAt ? new Date(row.completedAt) : null,
            createdAt: row.createdAt ? new Date(row.createdAt) : null,
            updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
        };
    }

    private mapLog(row: any) {
        return {
            id: row.id,
            action: row.action,
            actorName: row.actorName,
            actorUserId: row.actorUserId,
            services: parseServices(this.parseJson(row.services)),
            description: row.description,
            createdAt: row.createdAt,
        };
    }

    private parseJson(raw: unknown) {
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") {
            try {
                return JSON.parse(raw);
            } catch {
                return [];
            }
        }
        return [];
    }

    private publicEvent(event: ReturnType<MaintenanceService["mapEvent"]>) {
        return {
            id: event.id,
            name: event.name,
            description: event.description,
            kind: event.kind,
            kindLabel: KIND_LABELS_HU[event.kind],
            status: event.status,
            services: event.services,
            serviceLabels: event.services.map((id) => SERVICE_LABELS_HU[id]),
            startsAt: event.startsAt.toISOString(),
            endsAt: event.endsAt.toISOString(),
            rangeLabel: this.formatRange(event.startsAt, event.endsAt),
        };
    }

    private banner(event: ReturnType<MaintenanceService["mapEvent"]>, active: boolean) {
        const pub = this.publicEvent(event);
        return {
            ...pub,
            active,
            title: active ? "Karbantartás folyamatban" : "Tervezett karbantartás",
            text: `${pub.rangeLabel}. Érintett szolgáltatások: ${pub.serviceLabels.join(", ") || "nincs korlátozás"}.`,
        };
    }

    private streamerNotice(event: ReturnType<MaintenanceService["mapEvent"]> | null, blocked: MaintenanceServiceId[]) {
        if (!event) return null;
        const live = blocked.includes("live_stream") || event.services.includes("live_stream");
        if (live && event.status === "active") {
            return {
                tone: "danger" as const,
                title: "Figyelem.",
                text: "Az élő közvetítés a karbantartás alatt nem indítható.",
            };
        }
        return {
            tone: "warning" as const,
            title: "Karbantartás várható.",
            text: live
                ? "Az élő közvetítés a karbantartás alatt nem indítható."
                : "Az élő közvetítés nem érintett.",
        };
    }

    private formatRange(start: Date, end: Date) {
        const fmt = (d: Date) =>
            d.toLocaleString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
        return `${fmt(start)} – ${fmt(end)}`;
    }
}
