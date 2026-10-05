import { randomUUID } from "crypto";
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { sanitizeUserText } from "../security/sanitize-text";

const TARGETS = ["question", "review", "streamer", "show", "chat"] as const;
const REASONS = ["spam", "harassment", "illegal", "off_platform", "other"] as const;
const STATUSES = ["open", "dismissed", "actioned"] as const;

@Injectable()
export class ReportsService implements OnModuleInit {
    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        await this.ensureSchema();
    }

    async create(
        reporterId: string,
        body: { targetType?: string; targetId?: string; reason?: string; details?: string },
    ) {
        const targetType = String(body.targetType || "").trim().toLowerCase();
        const targetId = String(body.targetId || "").trim();
        const reason = String(body.reason || "").trim().toLowerCase();
        const details = sanitizeUserText(body.details, 500) || null;
        if (!TARGETS.includes(targetType as (typeof TARGETS)[number])) {
            throw new BadRequestException("Érvénytelen jelentés cél.");
        }
        if (!targetId) throw new BadRequestException("A targetId kötelező.");
        if (!REASONS.includes(reason as (typeof REASONS)[number])) {
            throw new BadRequestException("Válassz indokot.");
        }

        await this.assertTargetExists(targetType, targetId);
        await this.assertNotSelf(reporterId, targetType, targetId);

        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT id, status FROM "ContentReport"
            WHERE "reporterId" = ${reporterId}
              AND "targetType" = ${targetType}
              AND "targetId" = ${targetId}
            LIMIT 1
        `;
        if (existing[0]) {
            if (existing[0].status === "open") {
                throw new BadRequestException("Ezt már jelentetted.");
            }
            throw new BadRequestException("Ezt a tartalmat már jelentetted.");
        }

        const id = randomUUID();
        const rows = await this.prisma.$queryRaw<any[]>`
            INSERT INTO "ContentReport"
                (id, "reporterId", "targetType", "targetId", reason, details, status, "createdAt")
            VALUES (${id}, ${reporterId}, ${targetType}, ${targetId}, ${reason}, ${details}, 'open', NOW())
            RETURNING id, "targetType", "targetId", reason, status, "createdAt"
        `;
        return rows[0];
    }

    async listForModerator(status?: string) {
        const st = String(status || "open").trim().toLowerCase();
        if (st === "all") {
            return this.prisma.$queryRaw<any[]>`
                SELECT r.*, u.email AS "reporterEmail"
                FROM "ContentReport" r
                JOIN "User" u ON u.id = r."reporterId"
                ORDER BY r."createdAt" DESC
                LIMIT 200
            `;
        }
        if (!STATUSES.includes(st as (typeof STATUSES)[number])) {
            throw new BadRequestException("Érvénytelen státusz.");
        }
        return this.prisma.$queryRaw<any[]>`
            SELECT r.*, u.email AS "reporterEmail"
            FROM "ContentReport" r
            JOIN "User" u ON u.id = r."reporterId"
            WHERE r.status = ${st}
            ORDER BY r."createdAt" DESC
            LIMIT 200
        `;
    }

    async listForStreamer(streamerId: string, status?: string) {
        const showIds = (
            await this.prisma.show.findMany({
                where: { streamerId },
                select: { id: true },
            })
        ).map((s) => s.id);
        const streamer = await this.prisma.streamer.findUnique({
            where: { id: streamerId },
            select: { id: true },
        });
        if (!streamer) throw new NotFoundException("A tartalomkészítő nem található.");

        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT r.*, u.email AS "reporterEmail"
            FROM "ContentReport" r
            JOIN "User" u ON u.id = r."reporterId"
            ORDER BY r."createdAt" DESC
            LIMIT 400
        `;
        const owned = await this.ownedTargetIds(showIds);
        const mine = rows.filter((r) => this.belongsToStreamer(r, streamer.id, showIds, owned));
        const st = String(status || "open").trim().toLowerCase();
        if (st === "all") return mine.slice(0, 200);
        return mine.filter((r) => r.status === st).slice(0, 200);
    }

    async resolve(actorUserId: string, id: string, status?: string, note?: string) {
        const next = String(status || "").trim().toLowerCase();
        if (next !== "dismissed" && next !== "actioned") {
            throw new BadRequestException("A jelentés dismissed vagy actioned lehet.");
        }
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "ContentReport" WHERE id = ${id} LIMIT 1
        `;
        const row = rows[0];
        if (!row) throw new NotFoundException("A jelentés nem található.");
        const noteText = sanitizeUserText(note, 400) || null;
        const updated = await this.prisma.$queryRaw<any[]>`
            UPDATE "ContentReport"
            SET status = ${next},
                "reviewedAt" = NOW(),
                "reviewedById" = ${actorUserId},
                note = ${noteText}
            WHERE id = ${id}
            RETURNING *
        `;
        return updated[0];
    }

    async resolveForStreamer(streamerId: string, actorUserId: string, id: string, status?: string, note?: string) {
        const row = await this.requireStreamerReport(streamerId, id);
        if (row.reporterId === actorUserId && row.targetType === "streamer") {
            throw new ForbiddenException("Saját profilod elleni jelentést platform-moderátor zárja.");
        }
        return this.resolve(actorUserId, id, status, note);
    }

    private async requireStreamerReport(streamerId: string, id: string) {
        const showIds = (
            await this.prisma.show.findMany({
                where: { streamerId },
                select: { id: true },
            })
        ).map((s) => s.id);
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "ContentReport" WHERE id = ${id} LIMIT 1
        `;
        const row = rows[0];
        if (!row) throw new NotFoundException("A jelentés nem található.");
        const owned = await this.ownedTargetIds(showIds);
        if (!this.belongsToStreamer(row, streamerId, showIds, owned)) {
            throw new ForbiddenException("Csak a saját műsoraidhoz tartozó jelentéseket látod.");
        }
        return row;
    }

    private belongsToStreamer(
        row: any,
        streamerId: string,
        showIds: string[],
        owned: { questions: Set<string>; reviews: Set<string>; chats: Set<string> },
    ) {
        if (row.targetType === "streamer") return row.targetId === streamerId;
        if (row.targetType === "show") return showIds.includes(row.targetId);
        if (row.targetType === "question") return owned.questions.has(row.targetId);
        if (row.targetType === "review") return owned.reviews.has(row.targetId);
        if (row.targetType === "chat") return owned.chats.has(row.targetId);
        return false;
    }

    private async ownedTargetIds(showIds: string[]) {
        const empty = {
            questions: new Set<string>(),
            reviews: new Set<string>(),
            chats: new Set<string>(),
        };
        if (!showIds.length) return empty;
        const [questions, reviews, chats] = await Promise.all([
            this.prisma.question.findMany({
                where: { showId: { in: showIds } },
                select: { id: true },
            }),
            this.prisma.review.findMany({
                where: { showId: { in: showIds } },
                select: { id: true },
            }),
            this.prisma.chatMessage
                .findMany({
                    where: { showId: { in: showIds } },
                    select: { id: true },
                })
                .catch(() => [] as { id: string }[]),
        ]);
        return {
            questions: new Set(questions.map((r) => r.id)),
            reviews: new Set(reviews.map((r) => r.id)),
            chats: new Set(chats.map((r) => r.id)),
        };
    }

    private async assertNotSelf(reporterId: string, targetType: string, targetId: string) {
        if (targetType === "streamer") {
            const s = await this.prisma.streamer.findUnique({
                where: { id: targetId },
                select: { userId: true },
            });
            if (s?.userId === reporterId) {
                throw new BadRequestException("Saját profilodat nem jelentheted.");
            }
        }
        if (targetType === "question") {
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT "userId" FROM "Question" WHERE id = ${targetId} LIMIT 1
            `;
            if (rows[0]?.userId === reporterId) {
                throw new BadRequestException("Saját kérdésedet nem jelentheted.");
            }
        }
        if (targetType === "review") {
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT "userId" FROM "Review" WHERE id = ${targetId} LIMIT 1
            `;
            if (rows[0]?.userId === reporterId) {
                throw new BadRequestException("Saját értékelésedet nem jelentheted.");
            }
        }
        if (targetType === "chat") {
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT "userId" FROM "ChatMessage" WHERE id = ${targetId} LIMIT 1
            `;
            if (rows[0]?.userId === reporterId) {
                throw new BadRequestException("Saját üzenetedet nem jelentheted.");
            }
        }
    }

    private async assertTargetExists(targetType: string, targetId: string) {
        if (targetType === "question") {
            const n = await this.prisma.$queryRaw<any[]>`SELECT id FROM "Question" WHERE id = ${targetId} LIMIT 1`;
            if (!n[0]) throw new NotFoundException("A kérdés nem található.");
        } else if (targetType === "review") {
            const n = await this.prisma.$queryRaw<any[]>`SELECT id FROM "Review" WHERE id = ${targetId} LIMIT 1`;
            if (!n[0]) throw new NotFoundException("Az értékelés nem található.");
        } else if (targetType === "streamer") {
            const n = await this.prisma.streamer.findUnique({ where: { id: targetId }, select: { id: true } });
            if (!n) throw new NotFoundException("A tartalomkészítő nem található.");
        } else if (targetType === "show") {
            const n = await this.prisma.show.findUnique({ where: { id: targetId }, select: { id: true } });
            if (!n) throw new NotFoundException("A műsor nem található.");
        } else if (targetType === "chat") {
            const n = await this.prisma.$queryRaw<any[]>`SELECT id FROM "ChatMessage" WHERE id = ${targetId} LIMIT 1`;
            if (!n[0]) throw new NotFoundException("Az üzenet nem található.");
        }
    }

    private async ensureSchema() {
        const stmts = [
            `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'approved'`,
            `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "filterReason" TEXT`,
            `CREATE TABLE IF NOT EXISTS "ContentReport" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "reporterId" TEXT NOT NULL,
                "targetType" TEXT NOT NULL,
                "targetId" TEXT NOT NULL,
                "reason" TEXT NOT NULL,
                "details" TEXT,
                "status" TEXT NOT NULL DEFAULT 'open',
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "reviewedAt" TIMESTAMP(3),
                "reviewedById" TEXT,
                "note" TEXT
            )`,
            `CREATE UNIQUE INDEX IF NOT EXISTS "ContentReport_reporterId_targetType_targetId_key"
                ON "ContentReport"("reporterId", "targetType", "targetId")`,
        ];
        for (const sql of stmts) {
            await this.prisma.$executeRawUnsafe(sql).catch(() => undefined);
        }
    }
}
