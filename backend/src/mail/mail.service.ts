import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { publicFrontendUrl } from "../auth/public-url";
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
    emailVerificationEmail,
    registrationEmail,
    streamerApprovedEmail,
    ticketPurchasedEmail,
    writeOutboxFile,
    opsAlertEmail,
    safetyAlertEmail,
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
    private consecutiveSmtpFails = 0;
    private lastSmtpError: string | null = null;
    private lastSmtpTo: string | null = null;
    private lastSmtpAt: string | null = null;
    private smtpAlertSent = false;

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
        const take = Math.min(200, Math.max(1, Number(limit) || 80));
        return this.prisma.$queryRaw<any[]>`
            SELECT id, type, "toEmail", subject, status, "relatedId", "createdAt"
            FROM "EmailLog"
            ORDER BY "createdAt" DESC
            LIMIT ${take}
        `;
    }

    registration(email: string, isStreamer = false, locale = "hu", verifyUrl?: string) {
        const tpl = registrationEmail(isStreamer, locale, verifyUrl);
        return this.queue({
            type: MAIL_TYPES.registration,
            to: email,
            ...tpl,
            relatedId: email,
        });
    }

    emailVerification(email: string, rawToken: string, locale = "hu") {
        const base = publicFrontendUrl();
        const verifyUrl = `${base}/verify-email?token=${encodeURIComponent(rawToken)}`;
        const tpl = emailVerificationEmail(verifyUrl, locale);
        return this.queue({
            type: MAIL_TYPES.email_verification,
            to: email,
            ...tpl,
            relatedId: randomUUID(),
        });
    }

    async ticketPurchased(ticketId: string, opts?: { force?: boolean }) {
        const ticket = await this.prisma.ticket.findUnique({
            where: { id: ticketId },
            include: { show: true, user: true },
        });
        if (!ticket?.user?.email || !isTicketActive(ticket.status)) return;
        const locale = (ticket.user as { locale?: string })?.locale || "hu";
        const tpl = ticketPurchasedEmail(
            ticket.show?.title || "Műsor",
            ticket.showId,
            locale,
        );
        return this.queue({
            type: MAIL_TYPES.ticket_purchased,
            to: ticket.user.email,
            ...tpl,
            relatedId: opts?.force ? `${ticket.id}:resend:${Date.now()}` : ticket.id,
        });
    }

    async packPurchased(userId: string, groupName: string, ticketCount: number, purchaseId?: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.email) return;
        const locale = (user as { locale?: string }).locale || "hu";
        const tpl = packPurchasedEmail(groupName, ticketCount, locale);
        return this.queue({
            type: MAIL_TYPES.ticket_purchased,
            to: user.email,
            ...tpl,
            relatedId: purchaseId || userId,
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
        const tpl = payoutRequestedEmail(payout.streamerName || payout.streamer?.name || "Tartalomkészítő", payout.amount);
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
        const base = publicFrontendUrl();
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
                const timeZone =
                    (ticket.user as { timezone?: string | null })?.timezone ||
                    (locale === "hu" ? "Europe/Budapest" : "UTC");
                const tpl = liveReminderEmail(show.title, show.id, show.startTime, locale, timeZone);
                await this.queue({
                    type: MAIL_TYPES.live_reminder,
                    to: ticket.user.email,
                    ...tpl,
                    relatedId: `${show.id}:${ticket.userId}`,
                });
            }
        }
    }

    smtpMonitor() {
        return {
            consecutiveFailures: this.consecutiveSmtpFails,
            threshold: this.smtpFailThreshold(),
            lastError: this.lastSmtpError,
            lastRecipient: this.lastSmtpTo,
            lastAt: this.lastSmtpAt,
            configured: Boolean(
                process.env.SMTP_HOST?.trim() &&
                    process.env.SMTP_USER?.trim() &&
                    process.env.SMTP_PASS?.trim(),
            ),
        };
    }

    safetyAlert(to: string, title: string, body: string) {
        const tpl = safetyAlertEmail(title, body);
        return this.queue({
            type: MAIL_TYPES.safety_alert,
            to,
            ...tpl,
            relatedId: title,
        });
    }

    async opsAlert(input: {
        kind: string;
        service: string;
        message: string;
        detail?: string | null;
        showId?: string | null;
        streamId?: string | null;
        extra?: string | null;
    }) {
        if (!this.alertsEnabled()) return;
        const to = String(process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL || "").trim().toLowerCase();
        if (!to.includes("@")) {
            this.logger.warn(`Ops riasztás (${input.kind}), de ADMIN_EMAIL nincs beállítva.`);
            return;
        }
        await this.persistOpsEvent(input);
        const cooldownMs = this.alertCooldownMs();
        const bucket = Math.floor(Date.now() / cooldownMs);
        const tpl = opsAlertEmail({
            ...input,
            env: process.env.NODE_ENV || "development",
        });
        await this.dispatch({
            type: MAIL_TYPES.ops_alert,
            to,
            ...tpl,
            relatedId: `${input.kind}:${bucket}`,
        }).catch((err) => {
            this.logger.warn(`Ops riasztás nem ment ki: ${err?.message || err}`);
        });
    }

    private queue(payload: MailPayload) {
        return this.dispatch(payload).catch((err) => {
            this.logger.warn(`Email nem ment ki (${payload.type}): ${err?.message || err}`);
        });
    }

    private async dispatch(payload: MailPayload) {
        const to = String(payload.to || "").trim().toLowerCase();
        if (!to || !to.includes("@")) return;

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
        const smtp = await this.sendSmtp(to, payload.subject, payload.html, payload.text);
        if (smtp.ok) status = "sent";
        else if (smtp.attempted) status = "failed";
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

        if (payload.type !== MAIL_TYPES.ops_alert) {
            if (smtp.ok) {
                this.consecutiveSmtpFails = 0;
                this.smtpAlertSent = false;
            } else if (smtp.attempted) {
                this.consecutiveSmtpFails += 1;
                this.lastSmtpError = smtp.error || "SMTP hiba";
                this.lastSmtpTo = to;
                this.lastSmtpAt = new Date().toISOString();
                if (this.consecutiveSmtpFails >= this.smtpFailThreshold() && !this.smtpAlertSent) {
                    this.smtpAlertSent = true;
                    void this.opsAlert({
                        kind: "smtp_fail",
                        service: "mail",
                        message: `${this.consecutiveSmtpFails} egymást követő SMTP hiba.`,
                        extra: `Címzett: ${to}\nVálasz: ${this.lastSmtpError}\nIdőpont: ${this.lastSmtpAt}`,
                        detail: this.lastSmtpError,
                    });
                }
            }
        }
    }

    private async sendSmtp(to: string, subject: string, html: string, text: string) {
        const host = process.env.SMTP_HOST?.trim();
        const user = process.env.SMTP_USER?.trim();
        const pass = process.env.SMTP_PASS?.trim();
        if (!host || !user || !pass) return { ok: false, attempted: false as const };
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
            return { ok: true, attempted: true as const };
        } catch (err: any) {
            this.logger.warn(`SMTP sikertelen: ${err?.message || err}`);
            return { ok: false, attempted: true as const, error: String(err?.message || err) };
        }
    }

    private alertsEnabled() {
        const raw = String(process.env.ALERTS_ENABLED || "true").toLowerCase();
        return raw !== "false" && raw !== "0" && raw !== "off";
    }

    private smtpFailThreshold() {
        const n = Number(process.env.ALERT_SMTP_FAILS || 5);
        return Number.isFinite(n) && n >= 1 ? Math.min(100, n) : 5;
    }

    private alertCooldownMs() {
        const min = Number(process.env.ALERT_COOLDOWN_MINUTES || 30);
        const safe = Number.isFinite(min) && min >= 1 ? min : 30;
        return safe * 60_000;
    }

    private async persistOpsEvent(input: {
        kind: string;
        service: string;
        message: string;
        detail?: string | null;
        showId?: string | null;
        streamId?: string | null;
    }) {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "OpsEvent" (
                "id" TEXT NOT NULL PRIMARY KEY,
                kind TEXT NOT NULL,
                service TEXT NOT NULL,
                message TEXT NOT NULL,
                "showId" TEXT,
                "streamId" TEXT,
                detail TEXT,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `).catch(() => undefined);
        const cooldownMin = Math.max(1, Number(process.env.ALERT_COOLDOWN_MINUTES || 30));
        const recent = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "OpsEvent"
            WHERE kind = ${String(input.kind).slice(0, 40)}
              AND "createdAt" >= NOW() - (${cooldownMin} * INTERVAL '1 minute')
            LIMIT 1
        `.catch(() => []);
        if (recent[0]) return;
        await this.prisma.$executeRaw`
            INSERT INTO "OpsEvent" (id, kind, service, message, "showId", "streamId", detail, "createdAt")
            VALUES (
                ${randomUUID()},
                ${String(input.kind).slice(0, 40)},
                ${String(input.service).slice(0, 40)},
                ${String(input.message).slice(0, 500)},
                ${input.showId || null},
                ${input.streamId || null},
                ${input.detail ? String(input.detail).slice(0, 2000) : null},
                NOW()
            )
        `.catch(() => undefined);
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
