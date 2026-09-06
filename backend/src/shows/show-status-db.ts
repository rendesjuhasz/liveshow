import { PrismaService } from "../prisma/prisma.service";
import { normalizeShowStatus, type ShowStatus } from "./show-status";

export async function readShowStatuses(prisma: PrismaService, ids: string[]) {
    const map = new Map<string, ShowStatus>();
    if (!ids.length) return map;
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, COALESCE(status, 'active') AS status FROM "Show" WHERE id IN (${placeholders})`,
        ...ids,
    );
    for (const row of rows) {
        map.set(row.id, normalizeShowStatus(row.status));
    }
    return map;
}

export async function idsByShowStatus(prisma: PrismaService, statuses: ShowStatus[]) {
    if (!statuses.length) return [];
    const placeholders = statuses.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "Show" WHERE COALESCE(status, 'active') IN (${placeholders})`,
        ...statuses,
    );
    return rows.map((r) => r.id as string);
}

export async function setShowStatus(prisma: PrismaService, id: string, status: ShowStatus) {
    await prisma.$executeRaw`
        UPDATE "Show" SET status = ${status}, "updatedAt" = NOW() WHERE id = ${id}
    `;
}

export async function withShowStatus<T extends { id: string }>(prisma: PrismaService, show: T) {
    const map = await readShowStatuses(prisma, [show.id]);
    return { ...show, status: map.get(show.id) || "draft" };
}

export async function withShowStatuses<T extends { id: string }>(prisma: PrismaService, shows: T[]) {
    const map = await readShowStatuses(prisma, shows.map((s) => s.id));
    return shows.map((show) => ({
        ...show,
        status: map.get(show.id) || "draft",
    }));
}
