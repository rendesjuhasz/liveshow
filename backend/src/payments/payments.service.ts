import { randomUUID } from "crypto";
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from "@nestjs/common";
import { isAdminRole } from "../auth/roles";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { isTicketActive, TICKET_STATUSES } from "../tickets/ticket-status";
import {
    canActivateFromBarion,
    isBarionRefundStatus,
    isLocalRefundedStatus,
    isProtectedPackStatus,
    REFUND_SPEND_REASON,
    stripeObjectFullyRefunded,
} from "./payments-state";
import { barionEnabled, barionGetPaymentState, barionRefundPayment, barionStartPayment } from "./barion.client";
import { isDevPayAllowed } from "../auth/secrets";
import { publicBackendUrl, publicFrontendUrl } from "../auth/public-url";
import { ReferralService } from "../referrals/referral.service";
import { ModuleRef } from "@nestjs/core";

@Injectable()
export class PaymentsService implements OnModuleInit {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
        private readonly referrals: ReferralService,
        private readonly moduleRef: ModuleRef,
    ) {}

    async onModuleInit() {
        await this.ensurePackColumn();
        await this.ensureBarionColumn();
    }

    stripeEnabled() {
        return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
    }

    async createForTicket(ticket: {
        id: string;
        userId: string;
        showId: string;
        price: number;
    }) {

        if (ticket.price <= 0) {
            await this.activateTicket(ticket.id);
            const payment = await this.prisma.payment.create({
                data: {
                    userId: ticket.userId,
                    ticketId: ticket.id,
                    amount: 0,
                    status: "paid",
                    provider: "free",
                },
            });
            return { payment, checkoutUrl: null, devPay: false };
        }

        const existingPending = await this.prisma.payment.findFirst({
            where: { ticketId: ticket.id, status: "pending" },
            orderBy: { createdAt: "desc" },
        });

        if (this.stripeEnabled()) {
            const Stripe = (await import("stripe")).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
            if (existingPending?.stripeSessionId) {
                try {
                    const open = await stripe.checkout.sessions.retrieve(existingPending.stripeSessionId);
                    if (
                        open.payment_status !== "paid" &&
                        open.status !== "expired" &&
                        open.url
                    ) {
                        return { payment: existingPending, checkoutUrl: open.url, devPay: false };
                    }
                } catch {
                    /* új session */
                }
            }
            const frontend = publicFrontendUrl();
            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                line_items: [
                    {
                        quantity: 1,
                        price_data: {
                            currency: "huf",
                            unit_amount: ticket.price,
                            product_data: { name: `Jegy: ${ticket.showId}` },
                        },
                    },
                ],
                success_url: `${frontend}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${frontend}/payment/failed?session_id={CHECKOUT_SESSION_ID}`,
                metadata: { ticketId: ticket.id, userId: ticket.userId },
            });

            const payment = await this.prisma.payment.create({
                data: {
                    userId: ticket.userId,
                    ticketId: ticket.id,
                    amount: ticket.price,
                    status: "pending",
                    provider: "stripe",
                    stripeSessionId: session.id,
                },
            });

            if (!session.url) {
                throw new BadRequestException("A Stripe fizetési oldal nem jött létre.");
            }

            return { payment, checkoutUrl: session.url, devPay: false };
        }

        if (barionEnabled()) {
            if (existingPending?.provider === "barion") {
                return { payment: existingPending, checkoutUrl: null, devPay: false };
            }
            return this.createBarionPayment(ticket);
        }

        if (!isDevPayAllowed()) {
            throw new BadRequestException("Nincs beállított fizetési szolgáltató.");
        }

        if (existingPending?.provider === "dev") {
            return { payment: existingPending, checkoutUrl: null, devPay: true };
        }

        const payment = await this.prisma.payment.create({
            data: {
                userId: ticket.userId,
                ticketId: ticket.id,
                amount: ticket.price,
                status: "pending",
                provider: "dev",
            },
        });

        return { payment, checkoutUrl: null, devPay: true };
    }

    async createForPack(pack: { id: string; userId: string; price: number; label: string }) {

        if (pack.price <= 0) {
            await this.activatePack(pack.id);
            const paymentId = randomUUID();
            await this.prisma.$executeRaw`
                INSERT INTO "Payment" (id, "userId", "ticketId", "packPurchaseId", amount, status, provider, "createdAt")
                VALUES (${paymentId}, ${pack.userId}, NULL, ${pack.id}, 0, 'paid', 'free', NOW())
            `;
            return { payment: { id: paymentId, status: "paid" }, checkoutUrl: null, devPay: false };
        }

        const existingPending = await this.findPendingPackPayment(pack.id);

        if (this.stripeEnabled()) {
            const Stripe = (await import("stripe")).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
            if (existingPending?.stripeSessionId) {
                try {
                    const open = await stripe.checkout.sessions.retrieve(existingPending.stripeSessionId);
                    if (open.payment_status !== "paid" && open.status !== "expired" && open.url) {
                        return { payment: existingPending, checkoutUrl: open.url, devPay: false };
                    }
                } catch {
                    /* új session */
                }
            }
            const frontend = publicFrontendUrl();
            const session = await stripe.checkout.sessions.create({
                mode: "payment",
                line_items: [
                    {
                        quantity: 1,
                        price_data: {
                            currency: "huf",
                            unit_amount: pack.price,
                            product_data: { name: pack.label },
                        },
                    },
                ],
                success_url: `${frontend}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${frontend}/payment/failed?session_id={CHECKOUT_SESSION_ID}`,
                metadata: { packPurchaseId: pack.id, userId: pack.userId },
            });
            const paymentId = randomUUID();
            await this.prisma.$executeRaw`
                INSERT INTO "Payment" (id, "userId", "ticketId", "packPurchaseId", amount, status, provider, "stripeSessionId", "createdAt")
                VALUES (${paymentId}, ${pack.userId}, NULL, ${pack.id}, ${pack.price}, 'pending', 'stripe', ${session.id}, NOW())
            `;
            return { payment: { id: paymentId, status: "pending" }, checkoutUrl: session.url, devPay: false };
        }

        if (barionEnabled()) {
            return this.createBarionPackPayment(pack);
        }

        if (!isDevPayAllowed()) {
            throw new BadRequestException("Nincs beállított fizetési szolgáltató.");
        }

        if (existingPending?.provider === "dev") {
            return { payment: existingPending, checkoutUrl: null, devPay: true };
        }

        const paymentId = randomUUID();
        await this.prisma.$executeRaw`
            INSERT INTO "Payment" (id, "userId", "ticketId", "packPurchaseId", amount, status, provider, "createdAt")
            VALUES (${paymentId}, ${pack.userId}, NULL, ${pack.id}, ${pack.price}, 'pending', 'dev', NOW())
        `;
        return { payment: { id: paymentId, status: "pending" }, checkoutUrl: null, devPay: true };
    }

    async confirmDev(userId: string, ticketId: string, packPurchaseId?: string) {
        if (process.env.NODE_ENV === "production" || !isDevPayAllowed()) {
            throw new BadRequestException("A tesztfizetés ebben a környezetben ki van kapcsolva.");
        }
        const packId = String(packPurchaseId || "").trim();
        if (packId) {
            await this.assertPackOwner(packId, userId);
            await this.prisma.$executeRaw`
                UPDATE "Payment" SET status = 'paid'
                WHERE "packPurchaseId" = ${packId} AND "userId" = ${userId} AND status = 'pending'
            `;
            await this.activatePack(packId);
            return {
                message: "A tesztfizetés sikeres, a jegycsomag aktív.",
                packPurchaseId: packId,
            };
        }

        const ticket = await this.prisma.ticket.findFirst({
            where: { id: ticketId, userId },
            include: { show: true },
        });
        if (!ticket) throw new NotFoundException("A jegy nem található.");

        await this.prisma.payment.updateMany({
            where: { ticketId: ticket.id, status: "pending" },
            data: { status: "paid" },
        });
        await this.activateTicket(ticket.id);

        const activated = await this.prisma.ticket.findUnique({
            where: { id: ticket.id },
            include: { show: true },
        });

        return {
            message: "A tesztfizetés sikeres, a jegy jogosultságai aktívak.",
            ticket: activated,
            streamAccess: "STREAM_ACCESS_GRANTED",
        };
    }

    async confirmStripeSession(sessionId: string, userId: string) {
        const id = String(sessionId || "").trim();
        if (!id) throw new BadRequestException("A sessionId kötelező.");
        if (!this.stripeEnabled()) {
            throw new BadRequestException("A Stripe nincs beállítva.");
        }

        const payment = await this.prisma.payment.findUnique({
            where: { stripeSessionId: id },
            include: { ticket: { include: { show: true } } },
        });
        if (!payment) throw new NotFoundException("A fizetés nem található.");
        if (payment.userId !== userId) {
            throw new BadRequestException("Ez a fizetés nem a te fiókodhoz tartozik.");
        }
        if (payment.status === "paid") {
            return this.paidResult(payment);
        }
        if (isLocalRefundedStatus(payment.status)) {
            return this.refundedResult(payment);
        }

        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
        const session = await stripe.checkout.sessions.retrieve(id);
        if (session.metadata?.userId && session.metadata.userId !== userId) {
            throw new BadRequestException("A Stripe session nem ehhez a felhasználóhoz tartozik.");
        }
        if (session.payment_status !== "paid") {
            throw new BadRequestException("A Stripe fizetés még nem teljesült.");
        }
        return this.fulfillPaidRecord(payment.id);
    }

    async handleStripeWebhook(rawBody: Buffer | string, signature: string) {
        const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
        if (!secret) {
            throw new BadRequestException("STRIPE_WEBHOOK_SECRET nincs beállítva.");
        }
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
        let event;
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature, secret);
        } catch (err: any) {
            throw new BadRequestException(err?.message || "Érvénytelen Stripe aláírás.");
        }
        const type = String(event.type || "");
        const obj = event.data.object as unknown as Record<string, unknown>;
        if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
            if (obj.payment_status === "paid" || type === "checkout.session.async_payment_succeeded") {
                await this.fulfillStripeSessionId(String(obj.id || ""));
            }
        } else if (type === "checkout.session.expired" || type === "checkout.session.async_payment_failed") {
            await this.failStripeSession(
                String(obj.id || ""),
                type === "checkout.session.expired" ? "cancelled" : "failed",
            );
        } else if (type === "charge.refunded" || type === "refund.created" || type === "refund.updated") {
            if (stripeObjectFullyRefunded(type, obj)) {
                const pi = this.stripePaymentIntentId(obj);
                if (pi) await this.markRefundedByPaymentIntent(pi);
            }
        }
        return { received: true, type };
    }

    async cancelStripeCheckout(userId: string, sessionId?: string, ticketId?: string) {
        const sid = String(sessionId || "").trim();
        const tid = String(ticketId || "").trim();
        const payment = sid
            ? await this.prisma.payment.findUnique({ where: { stripeSessionId: sid } })
            : tid
              ? await this.prisma.payment.findFirst({
                    where: { ticketId: tid, userId, status: "pending" },
                    orderBy: { createdAt: "desc" },
                })
              : null;
        if (!payment || payment.userId !== userId) {
            throw new NotFoundException("A függő fizetés nem található.");
        }
        if (payment.status !== "pending") {
            return { message: "A fizetés már lezárult.", payment };
        }
        if (payment.stripeSessionId && this.stripeEnabled()) {
            try {
                const Stripe = (await import("stripe")).default;
                const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
                await stripe.checkout.sessions.expire(payment.stripeSessionId);
            } catch {
                /* a session már lezárult */
            }
        }
        await this.markFailed(
            payment.id,
            payment.ticketId,
            TICKET_STATUSES.CANCELLED,
            "cancelled",
        );
        return { message: "A fizetés megszakítva.", status: "cancelled" };
    }

    async refundPayment(paymentId: string) {
        const id = String(paymentId || "").trim();
        const payment = await this.prisma.payment.findUnique({ where: { id } });
        if (!payment) throw new NotFoundException("A fizetés nem található.");
        if (payment.status === "refunded") {
            return { message: "A fizetés már vissza lett térítve.", payment };
        }
        if (payment.status !== "paid") {
            throw new BadRequestException("Csak sikeres fizetés téríthető vissza.");
        }
        if (payment.provider === "stripe" && this.stripeEnabled() && payment.stripeSessionId) {
            const Stripe = (await import("stripe")).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
            const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
            const intent = session.payment_intent;
            const intentId = typeof intent === "string" ? intent : intent?.id;
            if (!intentId) {
                throw new BadRequestException("A Stripe payment_intent nem található.");
            }
            await stripe.refunds.create({ payment_intent: intentId });
        } else if (payment.provider === "barion") {
            const extras = await this.findByIdExtras(payment.id);
            const barionId = extras?.barionPaymentId;
            if (!barionId) throw new BadRequestException("Nincs Barion azonosító.");
            await barionRefundPayment({
                barionPaymentId: barionId,
                amount: payment.amount,
            });
        }
        await this.applyRefundLocal(payment.id, payment.ticketId);
        return { message: "A visszatérítés rögzítve.", status: "refunded" };
    }

    async handleBarionWebhook(paymentId: string) {
        const id = String(paymentId || "").trim();
        if (!id) {
            return { received: true, ignored: true };
        }
        try {
            await this.syncBarionPayment(id);
        } catch (err: any) {
            this.logger.warn(`Barion webhook: ${err?.message || err}`);
        }
        return { received: true };
    }

    async getBarionStatus(
        paymentId: string,
        user?: { id: string; email?: string; role?: string },
    ) {
        const id = String(paymentId || "").trim();
        if (!id) throw new BadRequestException("A PaymentId kötelező.");
        if (!user?.id) throw new ForbiddenException("Bejelentkezés szükséges.");
        try {
            const synced = await this.syncBarionPayment(id);
            if (synced.userId !== user.id && !isAdminRole(user)) {
                throw new ForbiddenException("Nincs jogosultság ehhez a fizetéshez.");
            }
            const extras = await this.paymentExtras(synced.id);
            let packPaid = false;
            if (extras?.packPurchaseId) {
                const pack = await this.prisma.$queryRaw<any[]>`
                    SELECT status FROM "TicketPackPurchase" WHERE id = ${extras.packPurchaseId} LIMIT 1
                `;
                packPaid = pack[0]?.status === "paid";
            }
            const ticket = synced.ticket;
            const active = isTicketActive(ticket?.status) || packPaid;
            return {
                paymentStatus: synced.status,
                ticketStatus: ticket?.status || (packPaid ? "paid" : null),
                streamAccess: active ? "STREAM_ACCESS_GRANTED" : "STREAM_ACCESS_DENIED",
                paid: active,
            };
        } catch (err: any) {
            if (err instanceof NotFoundException || err instanceof BadRequestException || err instanceof ForbiddenException) {
                throw err;
            }
            throw new BadRequestException(err?.message || "A Barion állapot nem kérhető le.");
        }
    }

    async listAll() {
        return this.prisma.payment.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, email: true } },
                ticket: { include: { show: { select: { id: true, title: true } } } },
            },
        });
    }

    private async createBarionPayment(ticket: {
        id: string;
        userId: string;
        showId: string;
        price: number;
    }) {
        const show = await this.prisma.show.findUnique({ where: { id: ticket.showId } });
        const user = await this.prisma.user.findUnique({ where: { id: ticket.userId } });
        const frontend = publicFrontendUrl();
        const backend = publicBackendUrl();
        const payee = process.env.BARION_PAYEE!.trim();
        const title = show?.title || "LiveShow jegy";

        const payment = await this.prisma.payment.create({
            data: {
                userId: ticket.userId,
                ticketId: ticket.id,
                amount: ticket.price,
                status: "pending",
                provider: "barion",
            },
        });

        let started;
        try {
            started = await barionStartPayment({
                POSKey: process.env.BARION_POS_KEY,
                PaymentType: "Immediate",
                PaymentRequestId: payment.id,
                GuestCheckOut: true,
                FundingSources: ["All"],
                Locale: "hu-HU",
                Currency: "HUF",
                RedirectUrl: `${frontend}/payment/success?paymentId=`,
                CallbackUrl: `${backend}/api/barion/webhook`,
                OrderNumber: ticket.id,
                PayerHint: user?.email || undefined,
                Transactions: [
                    {
                        POSTransactionId: `${payment.id}-t1`,
                        Payee: payee,
                        Total: ticket.price,
                        Comment: title,
                        Items: [
                            {
                                Name: title,
                                Description: "Streaming jegy",
                                Quantity: 1,
                                Unit: "db",
                                UnitPrice: ticket.price,
                                ItemTotal: ticket.price,
                            },
                        ],
                    },
                ],
            });
        } catch (err: any) {
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: "failed" },
            });
            await this.prisma.ticket.update({
                where: { id: ticket.id },
                data: { status: TICKET_STATUSES.FAILED },
            });
            throw new BadRequestException(err?.message || "A Barion fizetés indítása sikertelen.");
        }

        await this.prisma.$executeRaw`
            UPDATE "Payment" SET "barionPaymentId" = ${started.PaymentId} WHERE id = ${payment.id}
        `;

        return { payment, checkoutUrl: started.GatewayUrl, devPay: false };
    }

    private async syncBarionPayment(barionPaymentId: string) {
        const state = await barionGetPaymentState(barionPaymentId);
        const requestId = String(state.PaymentRequestId || "").trim();

        let payment =
            (requestId
                ? await this.prisma.payment.findUnique({
                      where: { id: requestId },
                      include: { ticket: true },
                  })
                : null) ||
            (await this.findByBarionId(barionPaymentId));

        if (!payment) {
            throw new NotFoundException("A Barion fizetés nem található.");
        }

        const barionStatus = String(state.Status || "").trim();
        if (isLocalRefundedStatus(payment.status)) {
            return this.prisma.payment.findUniqueOrThrow({
                where: { id: payment.id },
                include: { ticket: true },
            });
        }
        if (isBarionRefundStatus(barionStatus)) {
            await this.applyRefundLocal(payment.id, payment.ticketId);
        } else if (canActivateFromBarion(payment.status, barionStatus)) {
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: "paid" },
            });
            const extras = await this.paymentExtras(payment.id);
            if (extras?.packPurchaseId) {
                await this.activatePack(extras.packPurchaseId);
            } else if (payment.ticketId) {
                await this.activateTicket(payment.ticketId);
            }
        } else if (barionStatus === "Failed") {
            await this.markFailed(payment.id, payment.ticketId, TICKET_STATUSES.FAILED, "failed");
        } else if (barionStatus === "Canceled" || barionStatus === "Expired") {
            await this.markFailed(payment.id, payment.ticketId, TICKET_STATUSES.CANCELLED, "cancelled");
        }

        return this.prisma.payment.findUniqueOrThrow({
            where: { id: payment.id },
            include: { ticket: true },
        });
    }

    private async markFailed(
        paymentId: string,
        ticketId: string | null | undefined,
        ticketStatus: string,
        paymentStatus: string,
    ) {
        if (ticketId) {
            const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
            if (isTicketActive(ticket?.status)) return;
        }
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: { status: paymentStatus },
        });
        if (ticketId) {
            await this.prisma.ticket.update({
                where: { id: ticketId },
                data: { status: ticketStatus },
            });
        }
        const extras = await this.paymentExtras(paymentId);
        if (extras?.packPurchaseId) {
            await this.prisma.$executeRaw`
                UPDATE "TicketPackPurchase"
                SET status = ${paymentStatus}
                WHERE id = ${extras.packPurchaseId}
                  AND status NOT IN ('paid', 'refunded')
            `;
        }
    }

    private async fulfillStripeSessionId(sessionId: string) {
        const payment = await this.prisma.payment.findUnique({ where: { stripeSessionId: sessionId } });
        if (!payment) return null;
        if (payment.status === "paid" || payment.status === "refunded") return payment;
        return this.fulfillPaidRecord(payment.id);
    }

    private async fulfillPaidRecord(paymentId: string) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { ticket: { include: { show: true } } },
        });
        if (!payment) throw new NotFoundException("A fizetés nem található.");
        if (isLocalRefundedStatus(payment.status)) {
            return this.refundedResult(payment);
        }
        if (payment.status !== "paid") {
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: "paid" },
            });
        }
        const extras = await this.paymentExtras(payment.id);
        if (extras?.packPurchaseId) {
            await this.activatePack(extras.packPurchaseId);
            return { packPurchaseId: extras.packPurchaseId };
        }
        await this.activateTicket(payment.ticketId);
        return this.paidResult(payment);
    }

    private paidResult(payment: { ticket?: unknown; id: string }) {
        return payment.ticket || { paymentId: payment.id, status: "paid" };
    }

    private refundedResult(payment: { ticket?: unknown; id: string }) {
        return payment.ticket || { paymentId: payment.id, status: "refunded" };
    }

    private async failStripeSession(sessionId: string, paymentStatus: "failed" | "cancelled") {
        const payment = await this.prisma.payment.findUnique({ where: { stripeSessionId: sessionId } });
        if (!payment || payment.status === "paid" || payment.status === "refunded") return;
        await this.markFailed(
            payment.id,
            payment.ticketId,
            paymentStatus === "failed" ? TICKET_STATUSES.FAILED : TICKET_STATUSES.CANCELLED,
            paymentStatus,
        );
    }

    private async applyRefundLocal(paymentId: string, ticketId?: string | null) {
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: { status: "refunded" },
        });
        if (ticketId) {
            await this.prisma.ticket.update({
                where: { id: ticketId },
                data: { status: TICKET_STATUSES.REFUNDED },
            });
        }
        const extras = await this.paymentExtras(paymentId);
        if (extras?.packPurchaseId) {
            await this.prisma.$executeRaw`
                UPDATE "TicketSpend"
                SET reason = ${REFUND_SPEND_REASON}, "calculatedAmount" = 0
                WHERE "purchaseId" = ${extras.packPurchaseId}
                  AND COALESCE(reason, '') <> ${REFUND_SPEND_REASON}
            `;
            await this.prisma.$executeRaw`
                UPDATE "TicketPackPurchase"
                SET status = 'refunded', "remainingCount" = 0
                WHERE id = ${extras.packPurchaseId}
                  AND status <> 'refunded'
            `;
        }
    }

    private async findByIdExtras(paymentId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT "packPurchaseId", "ticketId", "barionPaymentId"
            FROM "Payment"
            WHERE id = ${paymentId}
            LIMIT 1
        `.catch(() => []);
        return rows[0] || null;
    }

    private stripePaymentIntentId(obj: Record<string, unknown>) {
        const raw = obj.payment_intent;
        if (typeof raw === "string") return raw.trim();
        if (raw && typeof raw === "object" && "id" in raw) return String((raw as { id?: string }).id || "").trim();
        return "";
    }

    private async markRefundedByPaymentIntent(paymentIntent: string) {
        const pi = String(paymentIntent || "").trim();
        if (!pi || !this.stripeEnabled()) return null;
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
        const listed = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 5 });
        const sessionId = listed.data.map((row) => row.id).find(Boolean);
        if (!sessionId) return null;
        const payment = await this.prisma.payment.findUnique({ where: { stripeSessionId: sessionId } });
        if (!payment) return null;
        if (payment.status === "refunded") return payment;
        await this.applyRefundLocal(payment.id, payment.ticketId);
        return payment;
    }

    private async activateTicket(ticketId?: string | null) {
        if (!ticketId) return;
        const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw new NotFoundException("A jegy nem található.");
        if (isLocalRefundedStatus(ticket.status)) return;
        const already = isTicketActive(ticket.status);
        await this.prisma.ticket.update({
            where: { id: ticketId },
            data: { status: TICKET_STATUSES.ACTIVE },
        });
        if (!already) {
            void this.mail.ticketPurchased(ticketId);
        }
        const privateReq = await this.prisma.$queryRaw<any[]>`
            SELECT id, "selectedOfferId" FROM "PrivateRequest" WHERE "ticketId" = ${ticketId} LIMIT 1
        `.catch(() => []);
        if (privateReq[0]) {
            await this.prisma.$executeRaw`
                UPDATE "PrivateRequest" SET status = 'paid' WHERE id = ${privateReq[0].id}
            `.catch(() => undefined);
            if (privateReq[0].selectedOfferId) {
                await this.prisma.$executeRaw`
                    UPDATE "PrivateOffer"
                    SET status = 'closed'
                    WHERE "requestId" = ${privateReq[0].id} AND id <> ${privateReq[0].selectedOfferId}
                `.catch(() => undefined);
            }
        }
    }

    async activatePack(purchaseId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "TicketPackPurchase" WHERE id = ${purchaseId} LIMIT 1
        `;
        if (!rows[0]) throw new NotFoundException("A jegycsomag nem található.");
        if (isProtectedPackStatus(rows[0].status)) return rows[0];
        const updated = await this.prisma.$executeRaw`
            UPDATE "TicketPackPurchase"
            SET status = 'paid', "remainingCount" = "ticketCount", "paidAt" = NOW()
            WHERE id = ${purchaseId}
              AND status NOT IN ('paid', 'refunded')
        `;
        if (!updated) {
            const current = await this.prisma.$queryRaw<any[]>`
                SELECT * FROM "TicketPackPurchase" WHERE id = ${purchaseId} LIMIT 1
            `;
            return current[0] || rows[0];
        }
        void this.referrals.onPaidPurchase(rows[0].userId);
        void this.mail.packPurchased(
            rows[0].userId,
            rows[0].groupKey || rows[0].groupName || "pack",
            rows[0].ticketCount,
            purchaseId,
        );
        void this.maybeClaimFirstBuyerCampaign(rows[0]);
        return rows[0];
    }

    private async maybeClaimFirstBuyerCampaign(pack: {
        userId?: string;
        price?: number;
        source?: string;
    }) {
        const userId = String(pack?.userId || "").trim();
        if (!userId) return;
        if (String(pack.source || "purchase") !== "purchase") return;
        if (Number(pack.price) <= 0) return;
        try {
            const paidPurchases = await this.prisma.$queryRaw<any[]>`
                SELECT COUNT(*)::int AS n
                FROM "TicketPackPurchase"
                WHERE "userId" = ${userId}
                  AND status = 'paid'
                  AND COALESCE(price, 0) > 0
                  AND COALESCE(source, 'purchase') = 'purchase'
            `;
            if ((paidPurchases[0]?.n || 0) !== 1) return;
            const { GiftCampaignsService } = await import("../tickets/gift-campaigns.service");
            const campaigns = this.moduleRef.get(GiftCampaignsService, { strict: false });
            if (!campaigns?.tryClaimFirstBuyers) return;
            await campaigns.tryClaimFirstBuyers(userId);
        } catch (err: any) {
            this.logger.warn(`Első vásárlós kampány: ${err?.message || err}`);
        }
    }

    private async assertPackOwner(purchaseId: string, userId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "TicketPackPurchase" WHERE id = ${purchaseId} AND "userId" = ${userId} LIMIT 1
        `;
        if (!rows[0]) throw new NotFoundException("A jegycsomag nem található.");
    }

    private async paymentExtras(paymentId: string) {
        try {
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT "packPurchaseId", "ticketId" FROM "Payment" WHERE id = ${paymentId} LIMIT 1
            `;
            return rows[0] || null;
        } catch {
            return null;
        }
    }

    private async findPendingPackPayment(packId: string) {
        try {
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT id, status, provider, "stripeSessionId", "packPurchaseId"
                FROM "Payment"
                WHERE "packPurchaseId" = ${packId} AND status = 'pending'
                ORDER BY "createdAt" DESC
                LIMIT 1
            `;
            return rows[0] || null;
        } catch {
            return null;
        }
    }

    private async createBarionPackPayment(pack: {
        id: string;
        userId: string;
        price: number;
        label: string;
    }) {
        const user = await this.prisma.user.findUnique({ where: { id: pack.userId } });
        const frontend = publicFrontendUrl();
        const backend = publicBackendUrl();
        const payee = process.env.BARION_PAYEE!.trim();
        const paymentId = randomUUID();
        await this.prisma.$executeRaw`
            INSERT INTO "Payment" (id, "userId", "ticketId", "packPurchaseId", amount, status, provider, "createdAt")
            VALUES (${paymentId}, ${pack.userId}, NULL, ${pack.id}, ${pack.price}, 'pending', 'barion', NOW())
        `;
        let started;
        try {
            started = await barionStartPayment({
                POSKey: process.env.BARION_POS_KEY,
                PaymentType: "Immediate",
                PaymentRequestId: paymentId,
                GuestCheckOut: true,
                FundingSources: ["All"],
                Locale: "hu-HU",
                Currency: "HUF",
                RedirectUrl: `${frontend}/payment/success?paymentId=`,
                CallbackUrl: `${backend}/api/barion/webhook`,
                OrderNumber: pack.id,
                PayerHint: user?.email || undefined,
                Transactions: [
                    {
                        POSTransactionId: `${paymentId}-t1`,
                        Payee: payee,
                        Total: pack.price,
                        Comment: pack.label,
                        Items: [
                            {
                                Name: pack.label,
                                Description: "Jegycsomag",
                                Quantity: 1,
                                Unit: "db",
                                UnitPrice: pack.price,
                                ItemTotal: pack.price,
                            },
                        ],
                    },
                ],
            });
        } catch (err: any) {
            await this.prisma.payment.update({
                where: { id: paymentId },
                data: { status: "failed" },
            });
            throw new BadRequestException(err?.message || "A Barion fizetés indítása sikertelen.");
        }
        await this.prisma.$executeRaw`
            UPDATE "Payment" SET "barionPaymentId" = ${started.PaymentId} WHERE id = ${paymentId}
        `;
        return { payment: { id: paymentId, status: "pending" }, checkoutUrl: started.GatewayUrl, devPay: false };
    }

    private async ensurePackColumn() {
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Payment" ALTER COLUMN "ticketId" DROP NOT NULL`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "packPurchaseId" TEXT`,
        ).catch(() => undefined);
    }

    private async findByBarionId(barionPaymentId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "Payment" WHERE "barionPaymentId" = ${barionPaymentId} LIMIT 1
        `;
        if (!rows[0]?.id) return null;
        return this.prisma.payment.findUnique({
            where: { id: rows[0].id },
            include: { ticket: true },
        });
    }

    private async ensureBarionColumn() {
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "barionPaymentId" TEXT`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `CREATE UNIQUE INDEX IF NOT EXISTS "Payment_barionPaymentId_key" ON "Payment" ("barionPaymentId")`,
        ).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(
            `CREATE UNIQUE INDEX IF NOT EXISTS "Payment_ticket_pending_once"
             ON "Payment" ("ticketId")
             WHERE status = 'pending' AND "ticketId" IS NOT NULL`,
        ).catch(() => undefined);
    }
}
