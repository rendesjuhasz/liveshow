import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
    isVideoCategory,
    normalizeVideoCategory,
    type VideoCategory,
    videoCategoryFields,
} from "./video-categories";

export function parseRequiredVideoCategory(value?: string | null): VideoCategory {
    const next = String(value || "").trim().toLowerCase();
    if (!isVideoCategory(next)) {
        throw new BadRequestException("A videókategória kötelező. Válassz a listából.");
    }
    return next;
}

export function parseOptionalVideoCategory(value?: string | null): VideoCategory | null {
    const next = String(value || "").trim().toLowerCase();
    if (!next) return null;
    if (!isVideoCategory(next)) {
        throw new BadRequestException("Ismeretlen videókategória.");
    }
    return next;
}

export async function ensureVideoCategoryColumn(prisma: PrismaService) {
    await prisma.$executeRawUnsafe(
        `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "videoCategory" TEXT NOT NULL DEFAULT 'egyeb'`,
    );
    await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Show_videoCategory_idx" ON "Show"("videoCategory")`,
    );
}

export async function setShowVideoCategory(prisma: PrismaService, showId: string, category: string) {
    const value = normalizeVideoCategory(category);
    await prisma.$executeRaw`
        UPDATE "Show" SET "videoCategory" = ${value} WHERE id = ${showId}
    `;
}

export async function videoCategoryByShowIds(prisma: PrismaService, ids: string[]) {
    const map = new Map<string, string>();
    if (!ids.length) return map;
    const rows = await prisma.$queryRaw<{ id: string; videoCategory: string }[]>`
        SELECT id, "videoCategory" FROM "Show" WHERE id IN (${Prisma.join(ids)})
    `;
    for (const row of rows) {
        map.set(row.id, row.videoCategory);
    }
    return map;
}

export async function withVideoCategory<T extends { id: string }>(prisma: PrismaService, show: T) {
    const map = await videoCategoryByShowIds(prisma, [show.id]);
    return { ...show, ...videoCategoryFields(map.get(show.id)) };
}

export async function withVideoCategories<T extends { id: string }>(prisma: PrismaService, shows: T[]) {
    const map = await videoCategoryByShowIds(prisma, shows.map((show) => show.id));
    return shows.map((show) => ({ ...show, ...videoCategoryFields(map.get(show.id)) }));
}
