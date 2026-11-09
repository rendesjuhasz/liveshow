import { randomUUID } from "crypto";
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    Optional,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { sanitizeUserText } from "../security/sanitize-text";
import {
    CHAT_FLOOD_MS,
    MAX_CHAT_LEN,
    chatSpamReason,
    collectBannedWords,
    findBannedWord,
} from "../questions/question-filters";
import { WebrtcGateway } from "../webrtc-signaling/webrtc.gateway";
import { USERNAME_REQUIRED_MESSAGE } from "../auth/username";

@Injectable()
export class ChatService {
    constructor(
        private readonly prisma: PrismaService,
        @Optional() private readonly live?: WebrtcGateway,
    ) {}

    async listApproved(showId: string) {
        const id = this.requireShow(showId);
        const show = await this.prisma.show.findUnique({ where: { id }, select: { id: true } });
        if (!show) throw new NotFoundException("A műsor nem található.");
        try {
            return await this.prisma.$queryRaw<any[]>`
                SELECT c.id, c.text, c."createdAt", c.status,
                       COALESCE(NULLIF(u.username, ''), 'Néző') AS author
                FROM "ChatMessage" c
                JOIN "User" u ON u.id = c."userId"
                WHERE c."showId" = ${id}
                  AND c.status = 'approved'
                ORDER BY c."createdAt" DESC
                LIMIT 80
            `;
        } catch {
            return [];
        }
    }

    async listMine(userId: string, showId: string) {
        const id = this.requireShow(showId);
        return this.prisma.$queryRaw<any[]>`
            SELECT id, text, status, "filterReason", "createdAt"
            FROM "ChatMessage"
            WHERE "showId" = ${id} AND "userId" = ${userId}
            ORDER BY "createdAt" DESC
            LIMIT 20
        `.catch(() => []);
    }

    async post(userId: string, showId: string, text?: string) {
        const id = this.requireShow(showId);
        const body = sanitizeUserText(text, MAX_CHAT_LEN);
        if (!body) throw new BadRequestException("Az üzenet szövege kötelező.");

        const authorRow = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { username: true },
        });
        const author = String(authorRow?.username || "").trim();
        if (!author) {
            throw new ForbiddenException(USERNAME_REQUIRED_MESSAGE);
        }

        const show = await this.prisma.show.findUnique({ where: { id } });
        if (!show) throw new NotFoundException("A műsor nem található.");
        if (!show.live) {
            throw new BadRequestException("Chat csak élő adás alatt elérhető.");
        }

        const last = await this.prisma.$queryRaw<any[]>`
            SELECT "createdAt" FROM "ChatMessage"
            WHERE "showId" = ${id} AND "userId" = ${userId}
            ORDER BY "createdAt" DESC
            LIMIT 1
        `.catch(() => []);
        if (last[0] && Date.now() - new Date(last[0].createdAt).getTime() < CHAT_FLOOD_MS) {
            throw new BadRequestException("Túl gyorsan küldesz üzenetet.");
        }

        const dbWords = await this.prisma.$queryRaw<any[]>`
            SELECT word FROM "BannedWord"
        `.catch(() => []);
        const banned = collectBannedWords((dbWords || []).map((w) => w.word));
        const hit = findBannedWord(body, banned);
        const spam = chatSpamReason(body);

        let status = "approved";
        let filterReason: string | null = null;
        if (hit) {
            status = "rejected";
            filterReason = "Tiltott szó.";
        } else if (spam) {
            status = "rejected";
            filterReason = spam;
        }

        const msgId = randomUUID();
        try {
            await this.prisma.$executeRaw`
                INSERT INTO "ChatMessage" (id, "showId", "userId", text, status, "filterReason", "createdAt")
                VALUES (${msgId}, ${id}, ${userId}, ${body}, ${status}, ${filterReason}, NOW())
            `;
        } catch {
            if (status === "rejected") {
                throw new BadRequestException(filterReason || "Az üzenetet a szűrő elutasította.");
            }
            await this.prisma.$executeRaw`
                INSERT INTO "ChatMessage" (id, "showId", "userId", text, "createdAt")
                VALUES (${msgId}, ${id}, ${userId}, ${body}, NOW())
            `;
        }

        if (status === "rejected") {
            throw new BadRequestException(filterReason || "Az üzenetet a szűrő elutasította.");
        }

        const payload = {
            id: msgId,
            text: body,
            status,
            createdAt: new Date(),
            author,
        };
        this.live?.emitChat(id, payload);
        return payload;
    }

    async listForModeration(showId: string, actor: { streamerId?: string; isMod?: boolean }) {
        const id = this.requireShow(showId);
        await this.assertCanModerate(id, actor);
        return this.prisma.$queryRaw<any[]>`
            SELECT c.id, c.text, c.status, c."filterReason", c."createdAt",
                   u.email AS "userEmail",
                   COALESCE(NULLIF(u.username, ''), 'Néző') AS author
            FROM "ChatMessage" c
            JOIN "User" u ON u.id = c."userId"
            WHERE c."showId" = ${id}
            ORDER BY c."createdAt" DESC
            LIMIT 150
        `;
    }

    async hide(actor: { streamerId?: string; isMod?: boolean; userId: string }, messageId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT c.*, s."streamerId"
            FROM "ChatMessage" c
            JOIN "Show" s ON s.id = c."showId"
            WHERE c.id = ${messageId}
            LIMIT 1
        `;
        const row = rows[0];
        if (!row) throw new NotFoundException("Az üzenet nem található.");
        if (!actor.isMod) {
            if (!actor.streamerId || actor.streamerId !== row.streamerId) {
                throw new ForbiddenException("Nincs jogod eltávolítani az üzenetet.");
            }
        }
        await this.prisma.$executeRaw`
            UPDATE "ChatMessage"
            SET status = 'rejected', "filterReason" = 'Moderátor eltávolította.'
            WHERE id = ${messageId}
        `;
        return { id: messageId, status: "rejected" };
    }

    private async assertCanModerate(showId: string, actor: { streamerId?: string; isMod?: boolean }) {
        if (actor.isMod) return;
        const show = await this.prisma.show.findUnique({
            where: { id: showId },
            select: { streamerId: true },
        });
        if (!show) throw new NotFoundException("A műsor nem található.");
        if (!actor.streamerId || show.streamerId !== actor.streamerId) {
            throw new ForbiddenException("Csak a saját adásod chatjét moderálhatod.");
        }
    }

    private requireShow(showId?: string) {
        const id = String(showId || "").trim();
        if (!id) throw new BadRequestException("A showId kötelező.");
        return id;
    }
}
