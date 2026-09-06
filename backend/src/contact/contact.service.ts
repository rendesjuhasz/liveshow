import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { bootstrapAdminEmail } from "../auth/roles";

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
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
    }

    async submit(body: { name?: string; email?: string; message?: string }) {
        await this.ensureTable();
        const name = String(body?.name || "").trim();
        const email = String(body?.email || "").trim().toLowerCase();
        const message = String(body?.message || "").trim();

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
            INSERT INTO contact_messages (id, name, email, message, created_at)
            VALUES (${id}, ${name}, ${email}, ${message}, NOW())
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

    async list() {
        await this.ensureTable();
        return this.prisma.$queryRaw<any[]>`
            SELECT id, name, email, message, created_at AS "createdAt"
            FROM contact_messages
            ORDER BY created_at DESC
            LIMIT 200
        `;
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
        return bootstrapAdminEmail();
    }
}
