import {
    BadRequestException,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { TicketGroupsService } from "../tickets/ticket-groups.service";
import { endedShowIdSet } from "../shows/show-ended";
import { assertNoOffPlatformContact } from "../security/contact-leak";
import { sanitizeUserText } from "../security/sanitize-text";
import { assertSafeIds } from "../security/sql-ids";

const STATUSES = ["pending", "approved", "rejected"] as const;

function avg(rows: { rating: number }[]) {
    if (!rows.length) return 0;
    return Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / rows.length) * 10) / 10;
}

function isUniqueViolation(err: unknown) {
    const code = String((err as { code?: string })?.code || "");
    const meta = String((err as { meta?: { code?: string } })?.meta?.code || "");
    const message = err instanceof Error ? err.message : String(err || "");
    return code === "P2002" || code === "23505" || meta === "23505" || /unique/i.test(message);
}

@Injectable()
export class ReviewsService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly groups: TicketGroupsService,
    ) {}

    async onModuleInit() {
        await this.ensureStatus();
    }

    async listForShow(showId: string, viewerId?: string) {
        const reviews = await this.approvedRows({ showId });
        let mine = null;
        let canReview = false;
        const show = await this.prisma.show.findUnique({ where: { id: showId } });
        if (viewerId && show) {
            const own = await this.prisma.$queryRaw<any[]>`
                SELECT id, rating, comment, COALESCE(status, 'approved') AS status, "createdAt"
                FROM "Review"
                WHERE "showId" = ${showId} AND "userId" = ${viewerId}
                LIMIT 1
            `;
            mine = own[0] || null;
            const ended = await this.showHasEnded(show);
            let balance = 0;
            if (ended && !mine) {
                const wallet = await this.groups.balance(viewerId, showId);
                balance = Number(wallet.usableOnShow ?? wallet.balance) || 0;
            }
            if (mine) {
                canReview = ended;
            } else if (ended) {
                canReview = balance >= 1;
            }
            return {
                average: avg(reviews),
                count: reviews.length,
                reviews,
                mine,
                canReview,
                ended,
                needsTicket: ended && !mine && balance < 1,
            };
        }
        const ended = show ? await this.showHasEnded(show) : false;
        return {
            average: avg(reviews),
            count: reviews.length,
            reviews,
            mine,
            canReview,
            ended,
            needsTicket: false,
        };
    }

    async listForStreamer(streamerId: string, includeHidden = false) {
        const shows = await this.prisma.show.findMany({
            where: { streamerId },
            select: { id: true, title: true },
        });
        const ids = shows.map((s) => s.id);
        if (!ids.length) return { average: 0, count: 0, reviews: [] };
        assertSafeIds(ids);

        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        const statusSql = includeHidden ? "" : `AND COALESCE(r.status, 'approved') = 'approved'`;
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT r.id, r.rating, r.comment, r."createdAt", COALESCE(r.status, 'approved') AS status,
                    r."showId", s.title AS "showTitle"
             FROM "Review" r
             JOIN "Show" s ON s.id = r."showId"
             WHERE r."showId" IN (${placeholders}) ${statusSql}
             ORDER BY r."createdAt" DESC`,
            ...ids,
        );
        const visible = includeHidden
            ? rows.filter((r) => r.status === "approved")
            : rows;
        return {
            average: avg(visible),
            count: visible.length,
            reviews: rows.map((r) => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                status: r.status,
                createdAt: r.createdAt,
                show: { id: r.showId, title: r.showTitle },
            })),
        };
    }

    async create(userId: string, showId?: string, ratingRaw?: number, comment?: string) {
        const id = String(showId || "").trim();
        const rating = Math.round(Number(ratingRaw));
        if (!id) throw new BadRequestException("A showId kötelező.");
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            throw new BadRequestException("Az értékelés 1 és 5 csillag között legyen.");
        }
        const text = sanitizeUserText(comment, 1000) || null;
        if (text) assertNoOffPlatformContact(text);

        const show = await this.prisma.show.findUnique({ where: { id } });
        if (!show) throw new NotFoundException("A műsor nem található.");
        if (!(await this.showHasEnded(show))) {
            throw new BadRequestException("Értékelni a műsor után lehet.");
        }
        if (!show.streamerId) {
            throw new BadRequestException("Ehhez a műsorhoz nem tartozik tartalomkészítő.");
        }

        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.$queryRaw<any[]>`
                    SELECT id FROM "Review" WHERE "userId" = ${userId} AND "showId" = ${id} FOR UPDATE
                `;
                if (existing[0]) {
                    await tx.$executeRaw`
                        UPDATE "Review"
                        SET rating = ${rating}, comment = ${text}, status = 'pending'
                        WHERE id = ${existing[0].id}
                    `;
                    return { id: existing[0].id, rating, comment: text, status: "pending" };
                }

                const spent = await this.groups.spendOne(
                    {
                        viewerUserId: userId,
                        streamerId: show.streamerId as string,
                        showId: id,
                        reason: "review",
                    },
                    tx,
                );
                if (!spent) {
                    throw new BadRequestException("Nincs felhasználható jegyed. Vásárolj jegycsomagot.");
                }

                const reviewId = randomUUID();
                await tx.$executeRaw`
                    INSERT INTO "Review" (id, "showId", "userId", rating, comment, status, "createdAt")
                    VALUES (${reviewId}, ${id}, ${userId}, ${rating}, ${text}, 'pending', NOW())
                `;
                return { id: reviewId, rating, comment: text, status: "pending" };
            });
        } catch (err: unknown) {
            if (isUniqueViolation(err)) {
                const mine = await this.prisma.$queryRaw<any[]>`
                    SELECT id FROM "Review" WHERE "userId" = ${userId} AND "showId" = ${id} LIMIT 1
                `;
                if (mine[0]) {
                    await this.prisma.$executeRaw`
                        UPDATE "Review"
                        SET rating = ${rating}, comment = ${text}, status = 'pending'
                        WHERE id = ${mine[0].id}
                    `;
                    return { id: mine[0].id, rating, comment: text, status: "pending" };
                }
            }
            throw err;
        }
    }

    async listForModeration() {
        return this.prisma.$queryRaw<any[]>`
            SELECT r.id, r.rating, r.comment, COALESCE(r.status, 'approved') AS status, r."createdAt",
                   s.id AS "showId", s.title AS "showTitle",
                   u.email AS "userEmail"
            FROM "Review" r
            JOIN "Show" s ON s.id = r."showId"
            JOIN "User" u ON u.id = r."userId"
            ORDER BY
                CASE WHEN COALESCE(r.status, 'approved') = 'pending' THEN 0 ELSE 1 END,
                r."createdAt" DESC
        `;
    }

    async setStatus(id: string, status?: string) {
        const next = String(status || "").trim().toLowerCase();
        if (!STATUSES.includes(next as any)) {
            throw new BadRequestException("A státusz pending, approved vagy rejected lehet.");
        }
        const rows = await this.prisma.$queryRaw<any[]>`SELECT id FROM "Review" WHERE id = ${id} LIMIT 1`;
        if (!rows[0]) throw new NotFoundException("Az értékelés nem található.");
        await this.prisma.$executeRaw`UPDATE "Review" SET status = ${next} WHERE id = ${id}`;
        return { id, status: next };
    }

    async ratingsForStreamerIds(ids: string[]) {
        if (!ids.length) return new Map<string, { average: number; count: number }>();
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT s."streamerId" AS id,
                    ROUND(AVG(r.rating)::numeric, 1) AS average,
                    COUNT(*)::int AS count
             FROM "Review" r
             JOIN "Show" s ON s.id = r."showId"
             WHERE s."streamerId" IN (${placeholders})
               AND COALESCE(r.status, 'approved') = 'approved'
             GROUP BY s."streamerId"`,
            ...ids,
        );
        return new Map(
            rows.map((r) => [r.id, { average: Number(r.average) || 0, count: r.count || 0 }]),
        );
    }

    private async showHasEnded(show: { id: string; live: boolean; startTime: Date | null }) {
        const ids = await endedShowIdSet(this.prisma, [show]);
        return ids.has(show.id);
    }

    private async approvedRows(where: { showId: string }) {
        return this.prisma.$queryRaw<any[]>`
            SELECT id, rating, comment, "createdAt"
            FROM "Review"
            WHERE "showId" = ${where.showId} AND COALESCE(status, 'approved') = 'approved'
            ORDER BY "createdAt" DESC
        `;
    }

    private async ensureStatus() {
        await this.prisma.$executeRawUnsafe(`
            ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'approved'
        `).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(`
            ALTER TABLE "Review" ALTER COLUMN "status" SET DEFAULT 'pending'
        `).catch(() => undefined);
    }
}
