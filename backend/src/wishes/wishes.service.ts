import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { assertNoOffPlatformContact } from "../security/contact-leak";
import { sanitizeUserText } from "../security/sanitize-text";
import {
    OTLETGAZDA_BADGE,
    WISH_STATUSES,
    WISH_VISIBILITY,
    WISH_XP_REWARD,
    parseWishVisibility,
    publicAuthorName,
    wishStatusLabelHu,
} from "./wish-status";

const MAX_TEXT = 500;

@Injectable()
export class WishesService implements OnModuleInit {
    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        await this.ensureSchema();
    }

    private async ensureSchema() {
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "wishes" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'public'`,
        );
        await this.prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "wishes_visibility_idx" ON "wishes"("visibility")`,
        );
    }

    private toPublic(wish: any) {
        return {
            id: wish.id,
            text: wish.text,
            status: wish.status,
            statusLabel: wishStatusLabelHu(wish.status),
            visibility: parseWishVisibility(wish.visibility),
            createdAt: wish.createdAt,
            acceptedAt: wish.acceptedAt,
            completedAt: wish.completedAt,
            authorName: publicAuthorName(wish.user),
            streamer: wish.streamer
                ? { id: wish.streamer.id, name: wish.streamer.name }
                : null,
        };
    }

    private include() {
        return {
            user: { select: { name: true } },
            streamer: { select: { id: true, name: true } },
        } as const;
    }

    private async idsByVisibility(visibility: string, userId?: string) {
        const rows = userId
            ? await this.prisma.$queryRaw<{ id: string }[]>`
                  SELECT id FROM "wishes"
                  WHERE "visibility" = ${visibility} AND "user_id" = ${userId}
                  ORDER BY "created_at" DESC
                  LIMIT 80
              `
            : await this.prisma.$queryRaw<{ id: string }[]>`
                  SELECT id FROM "wishes"
                  WHERE "visibility" = ${visibility}
                  ORDER BY "created_at" DESC
                  LIMIT 80
              `;
        return rows.map((row) => row.id);
    }

    private async attachVisibility(rows: any[]) {
        if (!rows.length) return rows;
        const visRows = await this.prisma.$queryRaw<{ id: string; visibility: string }[]>`
            SELECT id, visibility FROM "wishes" WHERE id IN (${Prisma.join(rows.map((row) => row.id))})
        `;
        const map = new Map(visRows.map((row) => [row.id, row.visibility]));
        return rows.map((row) => ({ ...row, visibility: map.get(row.id) || WISH_VISIBILITY.PUBLIC }));
    }

    private async loadByIds(ids: string[]) {
        if (!ids.length) return [];
        const rows = await this.prisma.wish.findMany({
            where: { id: { in: ids } },
            include: this.include(),
        });
        const order = new Map(ids.map((id, index) => [id, index]));
        rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        const withVis = await this.attachVisibility(rows);
        return withVis.map((w) => this.toPublic(w));
    }

    async listPublic() {
        return this.loadByIds(await this.idsByVisibility(WISH_VISIBILITY.PUBLIC));
    }

    async listMine(userId: string, visibility?: string) {
        if (visibility) {
            return this.loadByIds(await this.idsByVisibility(parseWishVisibility(visibility), userId));
        }
        const rows = await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM "wishes" WHERE "user_id" = ${userId} ORDER BY "created_at" DESC LIMIT 80
        `;
        return this.loadByIds(rows.map((row) => row.id));
    }

    async listForStreamer() {
        const rows = await this.prisma.wish.findMany({
            orderBy: { createdAt: "desc" },
            include: this.include(),
            take: 120,
        });
        const withVis = await this.attachVisibility(rows);
        return withVis.map((w) => this.toPublic(w));
    }

    async create(userId: string, text?: string, visibility?: string) {
        const value = sanitizeUserText(text, MAX_TEXT);
        if (value.length < 8) {
            throw new BadRequestException("A kívánság legalább 8 karakter legyen.");
        }
        if (value.length > MAX_TEXT) {
            throw new BadRequestException(`A kívánság legfeljebb ${MAX_TEXT} karakter lehet.`);
        }
        assertNoOffPlatformContact(value);

        const vis = parseWishVisibility(visibility);
        const wish = await this.prisma.wish.create({
            data: {
                userId,
                text: value,
                status: WISH_STATUSES.PENDING,
            },
            include: this.include(),
        });
        await this.prisma.$executeRaw`
            UPDATE "wishes" SET "visibility" = ${vis} WHERE "id" = ${wish.id}
        `;
        return this.toPublic({ ...wish, visibility: vis });
    }

    async accept(wishId: string, streamer: { id: string; name: string }) {
        const wish = await this.prisma.wish.findUnique({ where: { id: wishId } });
        if (!wish) throw new NotFoundException("A kívánság nem található.");
        if (wish.status !== WISH_STATUSES.PENDING) {
            throw new ConflictException("Csak függőben lévő kívánságot lehet elfogadni.");
        }

        const updated = await this.prisma.wish.update({
            where: { id: wishId },
            data: {
                status: WISH_STATUSES.ACCEPTED,
                streamerId: streamer.id,
                acceptedAt: new Date(),
            },
            include: { user: { select: { name: true } }, streamer: { select: { id: true, name: true } } },
        });
        return this.toPublic(updated);
    }

    async reject(wishId: string) {
        const wish = await this.prisma.wish.findUnique({ where: { id: wishId } });
        if (!wish) throw new NotFoundException("A kívánság nem található.");
        if (wish.status !== WISH_STATUSES.PENDING) {
            throw new ConflictException("Csak függőben lévő kívánságot lehet elutasítani.");
        }

        const updated = await this.prisma.wish.update({
            where: { id: wishId },
            data: { status: WISH_STATUSES.REJECTED },
            include: { user: { select: { name: true } }, streamer: { select: { id: true, name: true } } },
        });
        return this.toPublic(updated);
    }

    async complete(wishId: string, streamer: { id: string }) {
        const wish = await this.prisma.wish.findUnique({ where: { id: wishId } });
        if (!wish) throw new NotFoundException("A kívánság nem található.");
        if (wish.status !== WISH_STATUSES.ACCEPTED) {
            throw new ConflictException("Csak elfogadott kívánságot lehet teljesítetté tenni.");
        }
        if (wish.streamerId !== streamer.id) {
            throw new ForbiddenException("Csak a vállaló tartalomkészítő jelölheti teljesítettnek.");
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            const next = await tx.wish.update({
                where: { id: wishId },
                data: { status: WISH_STATUSES.COMPLETED, completedAt: new Date() },
                include: { user: { select: { name: true } }, streamer: { select: { id: true, name: true } } },
            });

            const existing = await tx.userBadge.findUnique({ where: { wishId } });
            if (!existing) {
                await tx.user.update({
                    where: { id: wish.userId },
                    data: { xp: { increment: WISH_XP_REWARD } },
                });
                await tx.userBadge.create({
                    data: {
                        userId: wish.userId,
                        wishId,
                        key: OTLETGAZDA_BADGE.key,
                        title: OTLETGAZDA_BADGE.title,
                        description: OTLETGAZDA_BADGE.description,
                    },
                });
            }
            return next;
        });

        return this.toPublic(updated);
    }
}
