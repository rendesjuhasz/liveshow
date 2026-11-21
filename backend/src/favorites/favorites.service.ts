import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ensureFavoriteSchema } from "./favorite-schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMPORT = 80;

function assertShowId(raw?: string) {
    const showId = String(raw || "").trim();
    if (!UUID_RE.test(showId)) {
        throw new BadRequestException("Érvénytelen műsor.");
    }
    return showId;
}

@Injectable()
export class FavoritesService implements OnModuleInit {
    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        await ensureFavoriteSchema(this.prisma);
    }

    async list(userId: string) {
        const rows = await this.prisma.$queryRaw<
            { showId: string; title: string; image: string | null; startTime: Date | null; createdAt: Date }[]
        >`
            SELECT f."showId", s.title, s.image, s."startTime", f."createdAt"
            FROM "ShowFavorite" f
            INNER JOIN "Show" s ON s.id = f."showId"
            WHERE f."userId" = ${userId}
            ORDER BY f."createdAt" DESC
            LIMIT ${MAX_IMPORT}
        `;
        return rows.map((row) => ({
            id: row.showId,
            title: row.title,
            image: row.image || "",
            startTime: row.startTime ? new Date(row.startTime).toISOString() : null,
            at: new Date(row.createdAt).getTime(),
        }));
    }

    async add(userId: string, showIdRaw?: string) {
        const showId = assertShowId(showIdRaw);
        const show = await this.prisma.show.findUnique({ where: { id: showId }, select: { id: true } });
        if (!show) {
            throw new NotFoundException("A műsor nem található.");
        }
        await this.prisma.$executeRaw`
            INSERT INTO "ShowFavorite" (id, "userId", "showId", "createdAt")
            VALUES (${randomUUID()}, ${userId}, ${showId}, NOW())
            ON CONFLICT ("userId", "showId") DO NOTHING
        `;
        return { favorite: true, showId };
    }

    async remove(userId: string, showIdRaw?: string) {
        const showId = assertShowId(showIdRaw);
        await this.prisma.$executeRaw`
            DELETE FROM "ShowFavorite" WHERE "userId" = ${userId} AND "showId" = ${showId}
        `;
        return { favorite: false, showId };
    }

    async importIds(userId: string, showIds?: string[]) {
        const ids = [...new Set((Array.isArray(showIds) ? showIds : []).map((id) => String(id || "").trim()))]
            .filter((id) => UUID_RE.test(id))
            .slice(0, MAX_IMPORT);
        for (const showId of ids) {
            const show = await this.prisma.show.findUnique({
                where: { id: showId },
                select: { id: true },
            });
            if (!show) continue;
            await this.prisma.$executeRaw`
                INSERT INTO "ShowFavorite" (id, "userId", "showId", "createdAt")
                VALUES (${randomUUID()}, ${userId}, ${showId}, NOW())
                ON CONFLICT ("userId", "showId") DO NOTHING
            `;
        }
        return this.list(userId);
    }
}
