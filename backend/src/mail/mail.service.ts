import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { isTicketActive } from "../tickets/ticket-status";
import {
    MAIL_TYPES,
    archiveReadyEmail,
    packPurchasedEmail,
    liveReminderEmail,
    payoutApprovedEmail,
    payoutRequestedEmail,
    payoutPaidEmail,
    contactAdminEmail,
    contactUserEmail,
    passwordResetEmail,
    registrationEmail,
    streamerApprovedEmail,
    ticketPurchasedEmail,
    writeOutboxFile,
    type MailType,
} from "./mail.templates";

type MailPayload = {
    type: MailType;
    to: string;
    subject: string;
    html: string;
    text: string;
    relatedId?: string | null;
};

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MailService.name);
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        await this.ensureTable();
        this.timer = setInterval(() => {
            this.sendLiveReminders().catch((err) =>
                this.logger.warn(`Emlékeztető hiba: ${err?.message || err}`),
            );
        }, 60_000);
        this.sendLiveReminders().catch(() => undefined);
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }

    async listRecent(limit = 80) {
        await this.ensureTable();
        const take = Math.min(200, Math.max(1, Number(limit) || 80));
        return this.prisma.$queryRaw<any[]>`
            SELECT id, type, "toEmail", subject, status, "relatedId", "createdAt"
            FROM "EmailLog"
            ORDER BY "createdAt" DESC
            LIMIT ${take}
        `;
    }

    registration(email: string, isStreamer = false, locale = "hu") {
        const tpl = registrationEmail(isStreamer, locale);
        return this.queue({
            type: MAIL_TYPES.registration,
            to: email,
            ...tpl,
            relatedId: email,
        });
    }

    async ticketPurchased(ticketId: string) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            include: { show: true, category: true, user: true },
        });
        if (!ticket?.user?.email || !isTicketActive(ticket.status)) return;
        const locale = (ticket.user as { locale?: string })?.locale || "hu";
        const tpl = ticketPurchasedEmail(
            ticket.show?.title || "Műsor",
            ticket.showId,
            ticket.category?.name,
            locale,
        );
        return this.queue({
            type: MAIL_TYPES.ticket_purchased,
            to: ticket.user.email,
            ...tpl,
            relatedId: ticket.id,
        });
    }

    async packPurchased(userId: string, groupName: string, ticketCount: number) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.email) return;
        const locale = (user as { locale?: string }).locale || "hu";
        const tpl = packPurchasedEmail(groupName, ticketCount, locale);
        return this.queue({
            type: MAIL_TYPES.ticket_purchased,
            to: user.email,
            ...tpl,
            relatedId: userId,
        });
    }

    async archiveReady(showId: string) {
        const show = await this.prisma.show.findUnique({ where: { id: showId } });
        if (!show) return;
        const tickets = await this.prisma.ticket.findMany({
            where: { showId, status: { in: ["paid", "active"] } },
            include: { user: true },
        });
        const tpl = archiveReadyEmail(show.title, show.id);
        await Promise.all(
            tickets.map((ticket) =>
                ticket.user?.email
                    ? this.queue({
                          type: MAIL_TYPES.archive_ready,
                          to: ticket.user.email,
                          ...tpl,
                          relatedId: `${show.id}:${ticket.userId}`,
                      })
                    : Promise.resolve(),
            ),
        );
    }

    async streamerApproved(streamerId: string) {
        const streamer = await this.prisma.streamer.findUnique({ where: { id: streamerId } });
        if (!streamer) return;
        const to = streamer.contactEmail || streamer.email;
        const tpl = streamerApprovedEmail(streamer.name);
        return this.queue({
            type: MAIL_TYPES.streamer_approved,
            to,
            ...tpl,
            relatedId: streamer.id,
        });
    }

    async payoutRequested(payout: { id: string; amount: number; streamerName?: string; streamer?: { name?: string; email?: string } }) {
        const admins = await this.prisma.user.findMany({
            where: { role: "admin" },
            select: { email: true },
        });
        const tpl = payoutRequestedEmail(payout.streamerName || payout.streamer?.name || "Streamer", payout.amount);
        await Promise.all(
            admins.map((admin) =>
                admin.email
                    ? this.queue({
                          type: MAIL_TYPES.payout_requested,
                          to: admin.email,
                          ...tpl,
                          relatedId: `${payout.id}:${admin.email}`,
                      })
                    : Promise.resolve(),
            ),
        );
    }

    async payoutApproved(payoutId: string) {
        const payout = await this.prisma.payout.findUnique({
            where: { id: payoutId },
            include: { streamer: true },
        });
        if (!payout?.streamer) return;
        const to = payout.streamer.contactEmail || payout.streamer.email;
        const tpl = payoutApprovedEmail(payout.amount);
        return this.queue({
            type: MAIL_TYPES.payout_approved,
            to,
            ...tpl,
            relatedId: payout.id,
        });
    }

    async payoutPaid(payoutId: string) {
        const payout = await this.prisma.payout.findUnique({
            where: { id: payoutId },
            include: { streamer: true },
        });
        if (!payout?.streamer) return;
        const to = payout.streamer.contactEmail || payout.streamer.email;
        const tpl = payoutPaidEmail(payout.amount);
        return this.queue({
            type: MAIL_TYPES.payout_paid,
            to,
            ...tpl,
            relatedId: payout.id,
        });
    }

    sendContactToAdmin(to: string, name: string, email: string, message: string, messageId: string) {
        const tpl = contactAdminEmail(name, email, message);
        return this.queue({
            type: MAIL_TYPES.contact_admin,
            to,
            ...tpl,
            relatedId: messageId,
        });
    }

    sendContactToUser(to: string, name: string, messageId: string) {
        const tpl = contactUserEmail(name);
        return this.queue({
            type: MAIL_TYPES.contact_user,
            to,
            ...tpl,
            relatedId: messageId,
        });
    }

    passwordReset(email: string, rawToken: string, locale = "hu") {
        const base = String(process.env.FRONTEND_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
        const resetUrl = `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
        const tpl = passwordResetEmail(resetUrl, locale);
        return this.queue({
            type: MAIL_TYPES.password_reset,
            to: email,
            ...tpl,
            relatedId: randomUUID(),
        });
    }

    queueFollow(payload: { to: string; subject: string; html: string; text: string; relatedId?: string }) {
        return this.queue({
            type: MAIL_TYPES.follow_event,
            to: payload.to,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            relatedId: payload.relatedId,
        });
    }

    async sendLiveReminders() {
        await this.ensureTable();
        const from = new Date(Date.now() - 15 * 60_000);
        const to = new Date(Date.now() + 60 * 60_000);
        const shows = await this.prisma.show.findMany({
            where: {
                startTime: { gte: from, lte: to },
            },
            select: { id: true, title: true, startTime: true },
        });
        for (const show of shows) {
            const tickets = await this.prisma.ticket.findMany({
                where: { showId: show.id, status: { in: ["paid", "active"] } },
                include: { user: true },
            });
            for (const ticket of tickets) {
                if (!ticket.user?.email) continue;
                const locale = (ticket.user as { locale?: string })?.locale || "hu";
                const tpl = liveReminderEmail(show.title, show.id, show.startTime, locale);
                await this.queue({
                    type: MAIL_TYPES.live_reminder,
                    to: ticket.user.email,
                    ...tpl,
                    relatedId: `${show.id}:${ticket.userId}`,
                });
            }
        }
    }

    private queue(payload: MailPayload) {
        return this.dispatch(payload).catch((err) => {
            this.logger.warn(`Email nem ment ki (${payload.type}): ${err?.message || err}`);
        });
    }

    private async dispatch(payload: MailPayload) {
        const to = String(payload.to || "").trim().toLowerCase();
        if (!to || !to.includes("@")) return;
        await this.ensureTable();

        const relatedId = payload.relatedId || null;
        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "EmailLog"
            WHERE type = ${payload.type} AND "toEmail" = ${to}
              AND COALESCE("relatedId", '') = ${relatedId || ""}
            LIMIT 1
        `;
        if (existing[0]) return;

        const id = randomUUID();
        let status = "logged";
        const smtpSent = await this.sendSmtp(to, payload.subject, payload.html, payload.text);
        if (smtpSent) status = "sent";
        const file = writeOutboxFile({
            to,
            subject: payload.subject,
            html: payload.html,
            type: payload.type,
        });
        this.logger.log(`Email [${payload.type}] → ${to} (${status}, ${file})`);

        await this.prisma.$executeRaw`
            INSERT INTO "EmailLog" (id, type, "toEmail", subject, body, "relatedId", status, "createdAt")
            VALUES (${id}, ${payload.type}, ${to}, ${payload.subject}, ${payload.html}, ${relatedId}, ${status}, NOW())
        `.catch(() => undefined);
    }

    private async sendSmtp(to: string, subject: string, html: string, text: string) {
        const host = process.env.SMTP_HOST?.trim();
        const user = process.env.SMTP_USER?.trim();
        const pass = process.env.SMTP_PASS?.trim();
        if (!host || !user || !pass) return false;
        try {
            const nodemailer = require("nodemailer");
            const transporter = nodemailer.createTransport({
                host,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === "true",
                auth: { user, pass },
            });
            await transporter.sendMail({
                from: process.env.MAIL_FROM || user,
                to,
                subject,
                text,
                html,
            });
            return true;
        } catch (err: any) {
            this.logger.warn(`SMTP sikertelen: ${err?.message || err}`);
            return false;
        }
    }

    private async ensureTable() {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "EmailLog" (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                "toEmail" TEXT NOT NULL,
                subject TEXT NOT NULL,
                body TEXT NOT NULL,
                "relatedId" TEXT,
                status TEXT NOT NULL DEFAULT 'logged',
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `).catch(() => undefined);
        await this.prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "EmailLog_dedupe"
            ON "EmailLog" (type, "toEmail", COALESCE("relatedId", ''))
        `).catch(() => undefined);
    }
}
