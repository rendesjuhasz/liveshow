import {
    BadRequestException,
    ForbiddenException,
    GoneException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isAdminUser } from "../auth/is-admin";
import { MailService } from "../mail/mail.service";
import {
    ADMIN_ACCESS,
    featureLabel,
    publicWatchAccess,
    type AccessFeature,
    type TicketAccess,
} from "./entitlements";
import { isTicketActive, ticketStatusLabelHu } from "./ticket-status";
import { TicketGroupsService } from "./ticket-groups.service";
import { privateShowIds } from "../private-streams/private-schema";

@Injectable()
export class TicketsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
        private readonly groups: TicketGroupsService,
    ) {}

    private toTicketDto(ticket: any, canAsk = false) {
        const paid = isTicketActive(ticket.status);
        const access: TicketAccess = publicWatchAccess(canAsk);
        return {
            id: ticket.id,
            userId: ticket.userId,
            showId: ticket.showId,
            price: ticket.price,
            status: ticket.status,
            statusLabel: ticketStatusLabelHu(ticket.status),
            createdAt: ticket.createdAt,
            activated: paid,
            questionRedeemedAt: ticket.questionRedeemedAt || null,
            streamAccess: paid ? "STREAM_ACCESS_GRANTED" : "STREAM_ACCESS_DENIED",
            access,
            canAsk,
            show: ticket.show
                ? {
                      id: ticket.show.id,
                      title: ticket.show.title,
                      startTime: ticket.show.startTime,
                      price: ticket.show.price,
                      live: ticket.show.live,
                      streamId: ticket.show.streamId ?? null,
                  }
                : undefined,
        };
    }

    buy(_userId: string, _showId?: string, _categoryKey?: string): never {
        throw new GoneException(
            "A kategóriás műsorjegy-vásárlás megszűnt. Kérdésjegyet a jegycsomagokból lehet venni (POST /tickets/packs).",
        );
    }

    async listMine(userId: string) {
        const [tickets, wallet] = await Promise.all([
            this.prisma.ticket.findMany({
                where: { userId },
                include: { show: true },
                orderBy: { createdAt: "desc" },
            }),
            this.groups.balance(userId).catch(() => ({ balance: 0 })),
        ]);
        const canAsk = wallet.balance > 0;
        return {
            tickets: tickets.map((ticket) => this.toTicketDto(ticket, canAsk)),
        };
    }

    async getForShow(userId: string, showId: string) {
        const ticket = await this.prisma.ticket.findUnique({
            where: {
                userId_showId: { userId, showId },
            },
            include: { show: true },
        });

        const paid = isTicketActive(ticket?.status);
        const wallet = await this.groups.balance(userId, showId).catch(() => ({
            balance: 0,
            usableOnShow: 0,
        }));
        const usable = Number(wallet.usableOnShow ?? wallet.balance) || 0;
        const show = await this.prisma.show.findUnique({ where: { id: showId } });
        const hidden = show ? (await privateShowIds(this.prisma)).has(show.id) : false;

        let access: TicketAccess = publicWatchAccess(usable > 0);
        if (hidden) {
            access = {
                live: Boolean(paid),
                archive: false,
                questions: false,
                extras: false,
                privateStream: Boolean(paid),
            };
        }

        return {
            owned: Boolean(paid),
            activated: Boolean(paid),
            ticket: ticket ? this.toTicketDto(ticket, access.questions) : null,
            access,
            canAsk: access.questions,
            ticketBalance: usable,
            extrasContent: null,
            privateStreamId: access.privateStream ? show?.privateStreamId || null : null,
        };
    }

    async listAll() {
        const tickets = await this.prisma.ticket.findMany({
            include: {
                show: true,
                user: { select: { id: true, email: true, role: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        return tickets.map((ticket) => ({
            ...this.toTicketDto(ticket, false),
            user: ticket.user,
        }));
    }

    async resendPurchaseEmail(userId: string, ticketId: string, asAdmin = false) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            include: { show: true },
        });
        if (!ticket) throw new NotFoundException("A jegy nem található.");
        if (!asAdmin && ticket.userId !== userId) {
            throw new ForbiddenException("Ez nem a te jegyed.");
        }
        if (!isTicketActive(ticket.status)) {
            throw new BadRequestException("Csak aktív, kifizetett jegyről küldhető e-mail.");
        }
        await this.mail.ticketPurchased(ticket.id, { force: true });
        return { message: "A jegy e-mailje újraküldve." };
    }

    async assertCanWatch(
        user: { id?: string; email?: string; role?: string } | null | undefined,
        streamId?: string,
        showId?: string,
        feature: AccessFeature = "live",
    ) {
        const sid = streamId?.trim();
        if (!sid) {
            throw new BadRequestException("A streamId kötelező.");
        }

        if (isAdminUser(user)) {
            return { allowed: true, reason: "admin" as const, access: { ...ADMIN_ACCESS } };
        }

        const show = showId?.trim()
            ? await this.prisma.show.findUnique({ where: { id: showId.trim() } })
            : await this.prisma.show.findFirst({
                  where: { OR: [{ streamId: sid }, { privateStreamId: sid }] },
              });

        if (!show) {
            throw new NotFoundException("A műsor nem található.");
        }

        const userId = String(user?.id || "").trim();
        const ticket = userId
            ? await this.prisma.ticket.findUnique({
                  where: {
                      userId_showId: { userId, showId: show.id },
                  },
              })
            : null;

        const owner = show.streamerId
            ? await this.prisma.streamer.findUnique({ where: { id: show.streamerId } })
            : null;
        const isOwner = Boolean(userId && owner?.userId === userId);
        const marketplace = (await privateShowIds(this.prisma)).has(show.id);

        if (feature === "live" || feature === "archive" || (feature === "privateStream" && marketplace)) {
            if (!show.streamId && !show.privateStreamId) {
                throw new ForbiddenException("Ehhez a műsorhoz nincs stream.");
            }
            if (show.streamId !== sid && show.privateStreamId !== sid) {
                throw new ForbiddenException("A stream nem ehhez a műsorhoz tartozik.");
            }
            if (marketplace) {
                if (!isOwner && (!ticket || !isTicketActive(ticket.status))) {
                    throw new ForbiddenException(
                        "A privát stream csak a jegyet megvásárló nézőnek és a tartalomkészítőnek érhető el.",
                    );
                }
                return {
                    allowed: true,
                    reason: "private_watch" as const,
                    showId: show.id,
                };
            }
            if (feature === "live" || feature === "archive") {
                return {
                    allowed: true,
                    reason: "public_watch" as const,
                    showId: show.id,
                };
            }
        }

        if (isOwner) {
            return { allowed: true, reason: "streamer" as const, showId: show.id };
        }

        if (feature === "questions") {
            throw new ForbiddenException("A kérdésbeküldés kérdésjegy-egyenlegből megy, nem stream-jogosultság.");
        }

        if (feature === "extras" || feature === "privateStream") {
            throw new ForbiddenException(
                `A kategóriás VIP jogosultság kivezetésre került (${featureLabel(feature)}).`,
            );
        }

        throw new ForbiddenException("Ehhez a funkcióhoz nincs jogosultság.");
    }
}
