import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isAdminUser } from "../auth/is-admin";
import { PaymentsService } from "../payments/payments.service";
import { TicketCategoriesService } from "./ticket-categories.service";
import { GiftCampaignsService } from "./gift-campaigns.service";
import { MailService } from "../mail/mail.service";
import { accessForCategory, featureLabel, type AccessFeature } from "./entitlements";
import { TICKET_SALE_STATUSES, normalizeShowStatus } from "../shows/show-status";
import { withShowStatus } from "../shows/show-status-db";
import { isTicketActive, ticketStatusLabelHu } from "./ticket-status";
import { TicketGroupsService } from "./ticket-groups.service";
import { privateShowIds } from "../private-streams/private-schema";

@Injectable()
export class TicketsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly paymentsService: PaymentsService,
        private readonly categories: TicketCategoriesService,
        private readonly mail: MailService,
        private readonly campaigns: GiftCampaignsService,
        private readonly groups: TicketGroupsService,
    ) {}

    private toTicketDto(ticket: any) {
        const category = ticket.category;
        const paid = isTicketActive(ticket.status);
        const access = accessForCategory(category?.key, paid);
        if (ticket.questionRedeemedAt) access.questions = false;
        return {
            id: ticket.id,
            userId: ticket.userId,
            showId: ticket.showId,
            price: ticket.price,
            status: ticket.status,
            statusLabel: ticketStatusLabelHu(ticket.status),
            createdAt: ticket.createdAt,
            categoryKey: category?.key || null,
            categoryName: category?.name || null,
            activated: paid,
            questionRedeemedAt: ticket.questionRedeemedAt || null,
            streamAccess: paid ? "STREAM_ACCESS_GRANTED" : "STREAM_ACCESS_DENIED",
            access,
            canAsk: access.questions,
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

    async buy(userId: string, showId?: string, categoryKey?: string) {
        const id = showId?.trim();
        if (!id) {
            throw new BadRequestException("A showId kötelező.");
        }

        const show = await this.prisma.show.findUnique({
            where: { id },
        });

        if (!show) {
            throw new NotFoundException("A műsor nem található.");
        }

        const tagged = await withShowStatus(this.prisma, show);
        if (!TICKET_SALE_STATUSES.includes(normalizeShowStatus(tagged.status))) {
            throw new BadRequestException(
                tagged.status === "archived"
                    ? "Erre a műsorra már nem lehet új jegyet venni."
                    : "Ez a műsor jelenleg nem vásárolható.",
            );
        }

        const category = await this.categories.assertOffered(id, categoryKey || "nezo");

        const existing = await this.prisma.ticket.findUnique({
            where: {
                userId_showId: { userId, showId: id },
            },
            include: { show: true, category: true },
        });

        if (existing && isTicketActive(existing.status)) {
            return {
                message: "Már van jegyed ehhez a műsorhoz.",
                alreadyOwned: true,
                ticket: this.toTicketDto(existing),
            };
        }

        const promo = await this.campaigns.tryClaimFirstBuyers(userId, id);
        if (promo?.ticket) {
            const granted = await this.prisma.ticket.findUnique({
                where: { id: promo.ticket.id },
                include: { show: true, category: true },
            });
            return {
                message: promo.message,
                campaignGranted: true,
                alreadyOwned: false,
                ticket: this.toTicketDto(granted),
            };
        }

        if (existing) {

            const pending = await this.prisma.ticket.update({
                where: { id: existing.id },
                data: {
                    categoryId: category.id,
                    price: category.price,
                    status: category.price <= 0 ? "paid" : "pending",
                },
                include: { show: true, category: true },
            });

            if (category.price <= 0) {
                void this.mail.ticketPurchased(pending.id);
                return {
                    message: "A jegyvásárlás sikeres.",
                    alreadyOwned: false,
                    ticket: this.toTicketDto(pending),
                };
            }

            const checkout = await this.paymentsService.createForTicket(pending);
            return {
                message: "A jegy fizetésre vár.",
                alreadyOwned: false,
                ticket: this.toTicketDto(pending),
                checkoutUrl: checkout.checkoutUrl,
                devPay: checkout.devPay,
            };
        }

        const ticket = await this.prisma.ticket.create({
            data: {
                userId,
                showId: id,
                categoryId: category.id,
                price: category.price,
                status: category.price <= 0 ? "paid" : "pending",
            },
            include: { show: true, category: true },
        }).catch((err: { code?: string }) => {
            if (err?.code === "P2002") return null;
            throw err;
        });

        if (!ticket) {
            const again = await this.prisma.ticket.findUnique({
                where: { userId_showId: { userId, showId: id } },
                include: { show: true, category: true },
            });
            if (again && isTicketActive(again.status)) {
                return {
                    message: "Már van jegyed ehhez a műsorhoz.",
                    alreadyOwned: true,
                    ticket: this.toTicketDto(again),
                };
            }
            throw new BadRequestException("A jegy létrehozása ütközött, próbáld újra.");
        }

        if (category.price <= 0) {
            void this.mail.ticketPurchased(ticket.id);
            return {
                message: "A jegyvásárlás sikeres.",
                alreadyOwned: false,
                ticket: this.toTicketDto(ticket),
            };
        }

        const checkout = await this.paymentsService.createForTicket(ticket);
        return {
            message: checkout.checkoutUrl
                ? "Átirányítás a fizetéshez."
                : "Tesztfizetés szükséges a jegy aktiválásához.",
            alreadyOwned: false,
            ticket: this.toTicketDto(ticket),
            checkoutUrl: checkout.checkoutUrl,
            devPay: checkout.devPay,
        };
    }

    async listMine(userId: string) {
        const tickets = await this.prisma.ticket.findMany({
            where: { userId },
            include: { show: true, category: true },
            orderBy: { createdAt: "desc" },
        });

        return {
            tickets: tickets.map((ticket) => this.toTicketDto(ticket)),
        };
    }

    async getForShow(userId: string, showId: string) {
        const ticket = await this.prisma.ticket.findUnique({
            where: {
                userId_showId: { userId, showId },
            },
            include: { show: true, category: true },
        });

        const paid = isTicketActive(ticket?.status);
        const access = paid
            ? accessForCategory((ticket as any)?.category?.key, true)
            : {
                  live: true,
                  archive: true,
                  questions: false,
                  extras: false,
                  privateStream: false,
              };
        access.live = true;
        access.archive = true;
        const wallet = await this.groups.balance(userId).catch(() => ({ balance: 0 }));
        access.questions = wallet.balance > 0;
        const show = await this.prisma.show.findUnique({ where: { id: showId } });
        const hidden = show ? (await privateShowIds(this.prisma)).has(show.id) : false;
        if (hidden) {
            access.live = Boolean(paid);
            access.archive = false;
            access.privateStream = Boolean(paid);
            access.questions = false;
            access.extras = false;
        }

        return {
            owned: Boolean(paid),
            activated: Boolean(paid),
            ticket: ticket ? this.toTicketDto(ticket) : null,
            access,
            ticketBalance: wallet.balance,
            extrasContent: access.extras ? show?.extrasContent || "" : null,
            privateStreamId: access.privateStream ? show?.privateStreamId || null : null,
        };
    }

    async listAll() {
        const tickets = await this.prisma.ticket.findMany({
            include: {
                show: true,
                category: true,
                user: { select: { id: true, email: true, role: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        return tickets.map((ticket) => ({
            ...this.toTicketDto(ticket),
            user: ticket.user,
        }));
    }

    async gift(email: string, showId: string, categoryKey?: string) {
        const normalized = email?.trim().toLowerCase();
        if (!normalized || !showId?.trim()) {
            throw new BadRequestException("Email és showId kötelező.");
        }

        const user = await this.prisma.user.findUnique({ where: { email: normalized } });
        if (!user) throw new NotFoundException("Nincs ilyen felhasználó.");

        const show = await this.prisma.show.findUnique({ where: { id: showId.trim() } });
        if (!show) throw new NotFoundException("A műsor nem található.");

        const category = await this.categories.assertOffered(show.id, categoryKey || "nezo");

        const existing = await this.prisma.ticket.findUnique({
            where: { userId_showId: { userId: user.id, showId: show.id } },
            include: { show: true, category: true },
        });
        if (existing && isTicketActive(existing.status)) {
            return {
                message: "Ehhez a műsorhoz már van érvényes jegye.",
                ticket: this.toTicketDto(existing),
            };
        }

        const ticket = await this.prisma.ticket.upsert({
            where: { userId_showId: { userId: user.id, showId: show.id } },
            create: {
                userId: user.id,
                showId: show.id,
                categoryId: category.id,
                price: 0,
                status: "active",
            },
            update: { status: "active", categoryId: category.id, price: 0 },
            include: { show: true, category: true },
        });

        void this.mail.ticketPurchased(ticket.id);
        try {
            await this.campaigns.logAdminGift(user.id, ticket.id);
        } catch {
            /* a kiosztás akkor is érvényes, ha a napló nem készül el */
        }
        return {
            message: "Ajándékjegy kiállítva.",
            ticket: this.toTicketDto(ticket),
        };
    }

    async assertCanWatch(
        user: { id: string; email?: string; role?: string },
        streamId?: string,
        showId?: string,
        feature: AccessFeature = "live",
    ) {
        const sid = streamId?.trim();
        if (!sid) {
            throw new BadRequestException("A streamId kötelező.");
        }

        if (isAdminUser(user)) {
            return { allowed: true, reason: "admin" as const, access: accessForCategory("vip", true) };
        }

        const show = showId?.trim()
            ? await this.prisma.show.findUnique({ where: { id: showId.trim() } })
            : await this.prisma.show.findFirst({
                  where: { OR: [{ streamId: sid }, { privateStreamId: sid }] },
              });

        if (!show) {
            throw new NotFoundException("A műsor nem található.");
        }

        const ticket = await this.prisma.ticket.findUnique({
            where: {
                userId_showId: { userId: user.id, showId: show.id },
            },
            include: { category: true },
        });

        const owner = show.streamerId
            ? await this.prisma.streamer.findUnique({ where: { id: show.streamerId } })
            : null;
        const isOwner = owner?.userId === user.id;
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
                        "A privát stream csak a jegyet megvásárló nézőnek és a streamernek érhető el.",
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

        if (!ticket || !isTicketActive(ticket.status)) {
            throw new ForbiddenException("Ehhez a prémium funkcióhoz érvényes jegy kell.");
        }

        const access = accessForCategory((ticket as any).category?.key, true);
        if (!access[feature]) {
            throw new ForbiddenException(
                `Ehhez a jegyhez nem jár: ${featureLabel(feature)}.`,
            );
        }

        if (feature === "privateStream") {
            if (!show.privateStreamId || (show.privateStreamId !== sid && show.streamId !== sid)) {
                throw new ForbiddenException("A privát stream nem ehhez a műsorhoz tartozik.");
            }
        }

        return {
            allowed: true,
            reason: "ticket" as const,
            showId: show.id,
            categoryKey: (ticket as any).category?.key,
            access,
        };
    }
}
