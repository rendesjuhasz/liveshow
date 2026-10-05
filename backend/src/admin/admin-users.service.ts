import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isAdminRole } from "../auth/roles";
import { isBannedAccount, isUserAccountStatus } from "../auth/account-status";
import { isStreamerStatus } from "../streamers/status";
import { MailService } from "../mail/mail.service";
import { TicketGroupsService } from "../tickets/ticket-groups.service";

@Injectable()
export class AdminUsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
        private readonly groups: TicketGroupsService,
    ) {}

    async listUsers() {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT u.id, u.email, u.role, u."createdAt",
                   COALESCE(u.status, 'active') AS status,
                   COALESCE(u.provider, 'local') AS provider,
                   u."lastLoginAt",
                   u."lastLoginProvider",
                   s.id AS "streamerId",
                   s.name AS "streamerName",
                   s.status AS "streamerStatus",
                   s."avatarUrl" AS "streamerAvatar"
            FROM "User" u
            LEFT JOIN "Streamer" s ON s."userId" = u.id
            ORDER BY u."createdAt" DESC
        `;
        return rows.map((u) => this.mapUserRow(u));
    }

    async getUserProfile(id: string) {
        const users = await this.prisma.$queryRaw<any[]>`
            SELECT u.id, u.email, u.role, u."createdAt",
                   COALESCE(u.status, 'active') AS status,
                   COALESCE(u.provider, 'local') AS provider,
                   u."lastLoginAt",
                   u."lastLoginProvider",
                   u."googleId",
                   u."microsoftId",
                   u."appleId",
                   u."avatarUrl"
            FROM "User" u
            WHERE u.id = ${id}
            LIMIT 1
        `;
        const user = users[0];
        if (!user) throw new NotFoundException("A felhasználó nem található.");

        const [tickets, payments, questions, streamer, authEvents] = await Promise.all([
            this.prisma.ticket.findMany({
                where: { userId: id },
                orderBy: { createdAt: "desc" },
                include: {
                    show: { select: { id: true, title: true } },
                },
            }),
            this.prisma.payment.findMany({
                where: { userId: id },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            this.prisma.$queryRaw<any[]>`
                SELECT id, "showId", text, status, "createdAt"
                FROM "Question"
                WHERE "userId" = ${id}
                ORDER BY "createdAt" DESC
                LIMIT 30
            `,
            this.prisma.streamer.findFirst({
                where: { userId: id },
                include: {
                    shows: { orderBy: { startTime: "desc" }, select: { id: true, title: true, live: true, startTime: true } },
                    payouts: { orderBy: { createdAt: "desc" } },
                },
            }),
            this.prisma.$queryRaw<any[]>`
                SELECT id, action, provider, "createdAt"
                FROM "AuthEvent"
                WHERE "userId" = ${id}
                ORDER BY "createdAt" DESC
                LIMIT 30
            `.catch(() => []),
        ]);

        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                status: user.status,
                createdAt: user.createdAt,
                provider: user.provider || "local",
                lastLoginAt: user.lastLoginAt || null,
                lastLoginProvider: user.lastLoginProvider || null,
                googleLinked: Boolean(user.googleId),
                microsoftLinked: Boolean(user.microsoftId),
                appleLinked: Boolean(user.appleId),
                avatarUrl: user.avatarUrl || null,
            },
            tickets,
            payments,
            questions,
            streamer,
            authEvents,
        };
    }

    async setUserStatus(actor: { id: string; email?: string }, id: string, status?: string) {
        const next = String(status || "").trim().toLowerCase();
        if (!isUserAccountStatus(next)) {
            throw new BadRequestException("A státusz active vagy banned lehet.");
        }
        await this.assertCanChangeUser(actor, id);

        await this.prisma.$executeRaw`
            UPDATE "User" SET status = ${next}, "updatedAt" = NOW() WHERE id = ${id}
        `;

        if (next === "banned") {
            await this.prisma.streamer.updateMany({
                where: { userId: id },
                data: { status: "banned" },
            });
        }

        return this.getUserProfile(id);
    }

    async listStreamers() {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT s.*,
                   u.id AS "linkedUserId",
                   u.email AS "userEmail",
                   u.role AS "userRole",
                   COALESCE(u.status, 'active') AS "userStatus"
            FROM "Streamer" s
            LEFT JOIN "User" u ON u.id = s."userId"
            ORDER BY s."createdAt" DESC
        `;
        return rows;
    }

    async getStreamerProfile(id: string) {
        const streamer = await this.prisma.streamer.findUnique({
            where: { id },
            include: {
                shows: { orderBy: { startTime: "desc" } },
                payouts: { orderBy: { createdAt: "desc" } },
                user: { select: { id: true, email: true, role: true } },
            },
        });
        if (!streamer) throw new NotFoundException("A tartalomkészítő nem található.");

        const userStatusRows = streamer.userId
            ? await this.prisma.$queryRaw<any[]>`
                SELECT COALESCE(status, 'active') AS status FROM "User" WHERE id = ${streamer.userId} LIMIT 1
              `
            : [];

        const ticketGroups = await this.groups.reportForStreamer(id).catch(() => null);

        return {
            ...streamer,
            userStatus: userStatusRows[0]?.status || (streamer.user ? "active" : null),
            ticketGroups,
        };
    }

    async setStreamerStatus(
        actor: { id: string; email?: string },
        id: string,
        status?: string,
    ) {
        const next = String(status || "").trim().toLowerCase();
        if (!isStreamerStatus(next)) {
            throw new BadRequestException(
                "Érvénytelen státusz. pending, approved, rejected vagy banned.",
            );
        }
        const streamer = await this.prisma.streamer.findUnique({ where: { id } });
        if (!streamer) throw new NotFoundException("A tartalomkészítő nem található.");
        if (streamer.userId) {
            await this.assertCanChangeUser(actor, streamer.userId);
        }

        await this.prisma.streamer.update({
            where: { id },
            data: { status: next },
        });

        if (next === "approved" && streamer.status !== "approved") {
            void this.mail.streamerApproved(id);
        }

        if (streamer.userId) {
            if (next === "banned") {
                await this.prisma.$executeRaw`
                    UPDATE "User" SET status = 'banned', "updatedAt" = NOW() WHERE id = ${streamer.userId}
                `;
            }
            if (next === "approved" || next === "pending" || next === "rejected") {
                await this.prisma.$executeRaw`
                    UPDATE "User" SET status = 'active', "updatedAt" = NOW() WHERE id = ${streamer.userId}
                `;
            }
        }

        return this.getStreamerProfile(id);
    }

    private async assertCanChangeUser(actor: { id: string; email?: string }, targetId: string) {
        if (actor.id === targetId) {
            throw new ForbiddenException("Saját fiókodat nem módosíthatod így.");
        }
        const target = await this.prisma.user.findUnique({ where: { id: targetId } });
        if (!target) throw new NotFoundException("A felhasználó nem található.");
        if (isAdminRole(target)) {
            throw new ForbiddenException("Admin fiókot nem lehet tiltani vagy módosítani.");
        }
    }

    private mapUserRow(u: any) {
        return {
            id: u.id,
            email: u.email,
            role: u.role,
            status: u.status,
            createdAt: u.createdAt,
            provider: u.provider || "local",
            lastLoginAt: u.lastLoginAt || null,
            lastLoginProvider: u.lastLoginProvider || null,
            banned: isBannedAccount(u.status),
            streamer: u.streamerId
                ? {
                      id: u.streamerId,
                      name: u.streamerName,
                      status: u.streamerStatus,
                      avatarUrl: u.streamerAvatar,
                  }
                : null,
        };
    }
}
