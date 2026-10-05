import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { sanitizeUserText } from "../security/sanitize-text";
import { assertSafeId } from "../security/sql-ids";
import {
    likePattern,
    messagePreview,
    parseContactPaging,
    parseContactStatusFilter,
    parseContactStatusValue,
    type ContactStatus,
} from "./contact-query";

@Injectable()
export class ContactService implements OnModuleInit {
    private readonly logger = new Logger(ContactService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
    ) {}

    async onModuleInit() {
        await this.ensureTable().catch((err) =>
            this.logger.warn(`Kapcsolat tábla: ${err?.message || err}`),
        );
    }

    async ensureTable() {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS contact_messages (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'new',
                admin_note TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await this.prisma.$executeRawUnsafe(`
            ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'
        `);
        await this.prisma.$executeRawUnsafe(`
            ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS admin_note TEXT NOT NULL DEFAULT ''
        `);
        await this.prisma.$executeRawUnsafe(`
            UPDATE contact_messages SET status = 'new' WHERE status IS NULL OR status = ''
        `);
        await this.prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON contact_messages (status)`,
        );
        await this.prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON contact_messages (created_at)`,
        );
    }

    async submit(body: { name?: string; email?: string; message?: string }) {
        const name = sanitizeUserText(body?.name, 120);
        const email = String(body?.email || "").trim().toLowerCase();
        const message = sanitizeUserText(body?.message, 5000);

        if (name.length < 2) {
            throw new BadRequestException("A név kötelező (legalább 2 karakter).");
        }
        if (!email.includes("@") || email.length < 5) {
            throw new BadRequestException("Érvényes email cím szükséges.");
        }
        if (message.length < 10) {
            throw new BadRequestException("Az üzenet legalább 10 karakter legyen.");
        }
        if (message.length > 5000) {
            throw new BadRequestException("Az üzenet legfeljebb 5000 karakter lehet.");
        }

        const id = randomUUID();
        await this.prisma.$executeRaw`
            INSERT INTO contact_messages (id, name, email, message, status, admin_note, created_at)
            VALUES (${id}, ${name}, ${email}, ${message}, 'new', '', NOW())
        `;

        const adminTo = await this.resolveAdminEmail();
        if (adminTo) {
            void this.mail.sendContactToAdmin(adminTo, name, email, message, id);
        } else {
            this.logger.warn("Nincs admin email a kapcsolatüzenethez.");
        }
        void this.mail.sendContactToUser(email, name, id);

        return {
            ok: true,
            id,
            message: "Köszönjük! Megkaptuk az üzenetedet, hamarosan válaszolunk.",
        };
    }

    async submitStreamerReport(input: {
        name: string;
        email: string;
        topic: string;
        description: string;
        screenshotPath?: string | null;
    }) {
        const labels: Record<string, string> = {
            live: "Élő adás",
            audio: "Hang",
            video: "Kép",
            payout: "Kifizetés",
            moderation: "Moderálás",
            other: "Egyéb",
        };
        const topic = labels[String(input.topic || "")] || "Egyéb";
        const shot = input.screenshotPath ? `\nKépernyőkép: ${input.screenshotPath}` : "";
        const message = `[Tartalomkészítő hibabejelentés]\nTípus: ${topic}${shot}\n\n${input.description}`;
        return this.submit({
            name: input.name,
            email: input.email,
            message,
        });
    }

    async list(query: { status?: string; q?: string; page?: unknown; pageSize?: unknown }) {
        const status = parseContactStatusFilter(query.status);
        const { page, pageSize } = parseContactPaging(query.page, query.pageSize);
        const q = sanitizeUserText(query.q, 200);

        const where: Prisma.Sql[] = [];
        if (status !== "all") {
            where.push(Prisma.sql`status = ${status}`);
        }
        if (q) {
            const like = likePattern(q);
            where.push(
                Prisma.sql`(name ILIKE ${like} OR email ILIKE ${like} OR message ILIKE ${like})`,
            );
        }
        const whereSql =
            where.length > 0 ? Prisma.sql`WHERE ${Prisma.join(where, " AND ")}` : Prisma.sql``;

        const countRows = await this.prisma.$queryRaw<{ n: bigint }[]>`
            SELECT COUNT(*)::bigint AS n
            FROM contact_messages
            ${whereSql}
        `;
        const total = Number(countRows[0]?.n || 0);
        const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
        const safePage = Math.min(page, pageCount);
        const safeSkip = (safePage - 1) * pageSize;

        const rows = await this.prisma.$queryRaw<
            {
                id: string;
                name: string;
                email: string;
                message: string;
                status: string;
                adminNote: string;
                createdAt: Date;
            }[]
        >`
            SELECT
                id,
                name,
                email,
                message,
                status,
                admin_note AS "adminNote",
                created_at AS "createdAt"
            FROM contact_messages
            ${whereSql}
            ORDER BY created_at DESC
            LIMIT ${pageSize}
            OFFSET ${safeSkip}
        `;

        return {
            items: rows.map((row) => ({
                ...row,
                preview: messagePreview(row.message),
            })),
            total,
            page: safePage,
            pageSize,
            pageCount,
        };
    }

    async update(id: string, body: { status?: string; adminNote?: string }) {
        assertSafeId(id, "üzenet azonosító");

        const existing = await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM contact_messages WHERE id = ${id} LIMIT 1
        `;
        if (!existing[0]) {
            throw new NotFoundException("Az üzenet nem található.");
        }

        let changed = false;
        if (body.status != null && body.status !== "") {
            const status: ContactStatus = parseContactStatusValue(body.status);
            await this.prisma.$executeRaw`
                UPDATE contact_messages SET status = ${status} WHERE id = ${id}
            `;
            changed = true;
        }
        if (body.adminNote != null) {
            const note = sanitizeUserText(body.adminNote, 2000);
            await this.prisma.$executeRaw`
                UPDATE contact_messages SET admin_note = ${note} WHERE id = ${id}
            `;
            changed = true;
        }
        if (!changed) {
            throw new BadRequestException("Nincs módosítható mező.");
        }

        const [row] = await this.prisma.$queryRaw<
            {
                id: string;
                name: string;
                email: string;
                message: string;
                status: string;
                adminNote: string;
                createdAt: Date;
            }[]
        >`
            SELECT
                id,
                name,
                email,
                message,
                status,
                admin_note AS "adminNote",
                created_at AS "createdAt"
            FROM contact_messages
            WHERE id = ${id}
            LIMIT 1
        `;
        return { ...row, preview: messagePreview(row.message) };
    }

    private async resolveAdminEmail() {
        const fromEnv = String(process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL || "").trim();
        if (fromEnv.includes("@")) return fromEnv.toLowerCase();
        const admin = await this.prisma.user.findFirst({
            where: { role: "admin" },
            select: { email: true },
            orderBy: { createdAt: "asc" },
        });
        if (admin?.email) return admin.email;
        return "";
    }
}
