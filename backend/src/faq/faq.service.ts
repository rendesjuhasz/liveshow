import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { DEFAULT_FAQS } from "./faq.seed";

export type FaqRow = {
    id: string;
    category: string;
    question: string;
    answer: string;
    order: number;
    isPublished: boolean;
    createdAt?: Date;
    updatedAt?: Date;
};

@Injectable()
export class FaqService implements OnModuleInit {
    private readonly logger = new Logger(FaqService.name);

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        try {
            await this.ensureTable();
            await this.seedIfEmpty();
            await this.alignLiveCopy();
        } catch (err: any) {
            this.logger.warn(`FAQ tábla: ${err?.message || err}`);
        }
    }

    async ensureTable() {
        await this.prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS faqs (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                "order" INTEGER NOT NULL DEFAULT 0,
                "isPublished" BOOLEAN NOT NULL DEFAULT TRUE,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
    }

    async listPublic(): Promise<FaqRow[]> {
        await this.ensureTable();
        return this.prisma.$queryRaw<FaqRow[]>`
            SELECT id, category, question, answer, "order", "isPublished", "createdAt", "updatedAt"
            FROM faqs
            WHERE "isPublished" = TRUE
            ORDER BY "order" ASC, "createdAt" ASC
        `;
    }

    async listAll(): Promise<FaqRow[]> {
        await this.ensureTable();
        return this.prisma.$queryRaw<FaqRow[]>`
            SELECT id, category, question, answer, "order", "isPublished", "createdAt", "updatedAt"
            FROM faqs
            ORDER BY "order" ASC, "createdAt" ASC
        `;
    }

    async create(body: {
        category?: string;
        question?: string;
        answer?: string;
        order?: number;
        isPublished?: boolean;
    }) {
        await this.ensureTable();
        const data = this.parseBody(body);
        const id = randomUUID();
        await this.prisma.$executeRaw`
            INSERT INTO faqs (id, category, question, answer, "order", "isPublished", "createdAt", "updatedAt")
            VALUES (${id}, ${data.category}, ${data.question}, ${data.answer}, ${data.order}, ${data.isPublished}, NOW(), NOW())
        `;
        return this.getById(id);
    }

    async update(
        id: string,
        body: {
            category?: string;
            question?: string;
            answer?: string;
            order?: number;
            isPublished?: boolean;
        },
    ) {
        await this.ensureTable();
        const current = await this.getById(id);
        const category = body.category !== undefined ? this.requireText(body.category, "kategória") : current.category;
        const question = body.question !== undefined ? this.requireText(body.question, "kérdés") : current.question;
        const answer = body.answer !== undefined ? this.requireText(body.answer, "válasz") : current.answer;
        const order = body.order !== undefined ? this.parseOrder(body.order) : current.order;
        const isPublished =
            body.isPublished !== undefined ? Boolean(body.isPublished) : current.isPublished;
        await this.prisma.$executeRaw`
            UPDATE faqs
            SET category = ${category},
                question = ${question},
                answer = ${answer},
                "order" = ${order},
                "isPublished" = ${isPublished},
                "updatedAt" = NOW()
            WHERE id = ${id}
        `;
        return this.getById(id);
    }

    async remove(id: string) {
        await this.ensureTable();
        await this.getById(id);
        await this.prisma.$executeRaw`DELETE FROM faqs WHERE id = ${id}`;
        return { ok: true };
    }

    private async getById(id: string) {
        const rows = await this.prisma.$queryRaw<FaqRow[]>`
            SELECT id, category, question, answer, "order", "isPublished", "createdAt", "updatedAt"
            FROM faqs WHERE id = ${id} LIMIT 1
        `;
        if (!rows[0]) throw new NotFoundException("A FAQ tétel nem található.");
        return rows[0];
    }

    private async alignLiveCopy() {
        await this.prisma.$executeRaw`
            UPDATE faqs
            SET question = ${"Hol nézhetem meg az élő adást?"},
                answer = ${"Az Élő menüpontban vagy a műsor oldalán. A megtekintés ingyenes; jegy csak a kérdésbeküldéshez és a prémium interakciókhoz kell."},
                "updatedAt" = NOW()
            WHERE question = ${"Hol nézhetem meg a megvásárolt közvetítést?"}
        `;
        await this.prisma.$executeRaw`
            UPDATE faqs
            SET answer = ${"Ellenőrizd: internetkapcsolat, bejelentkezés, támogatott böngésző. Jegy az élő és archív nézéshez nem kell."},
                "updatedAt" = NOW()
            WHERE question = ${"Nem indul el a stream."}
        `;
        await this.prisma.$executeRaw`
            UPDATE faqs
            SET answer = ${"A Visszanézés menüpontban. A megtekintés ingyenes; jegy csak a kérdésbeküldéshez és a prémium interakciókhoz kell."},
                "updatedAt" = NOW()
            WHERE question = ${"Hol találom az archív videókat?"}
        `;
    }

    private async seedIfEmpty() {
        const count = await this.prisma.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM faqs`;
        if ((count[0]?.n || 0) > 0) return;
        for (const item of DEFAULT_FAQS) {
            await this.prisma.$executeRaw`
                INSERT INTO faqs (id, category, question, answer, "order", "isPublished", "createdAt", "updatedAt")
                VALUES (${randomUUID()}, ${item.category}, ${item.question}, ${item.answer}, ${item.order}, TRUE, NOW(), NOW())
            `;
        }
        this.logger.log(`FAQ alapkészlet betöltve (${DEFAULT_FAQS.length} tétel).`);
    }

    private parseBody(body: {
        category?: string;
        question?: string;
        answer?: string;
        order?: number;
        isPublished?: boolean;
    }) {
        return {
            category: this.requireText(body.category, "kategória"),
            question: this.requireText(body.question, "kérdés"),
            answer: this.requireText(body.answer, "válasz"),
            order: this.parseOrder(body.order),
            isPublished: body.isPublished === undefined ? true : Boolean(body.isPublished),
        };
    }

    private requireText(value: unknown, label: string) {
        const text = String(value || "").trim();
        if (!text) throw new BadRequestException(`A ${label} kötelező.`);
        return text;
    }

    private parseOrder(value: unknown) {
        const n = Math.round(Number(value ?? 0));
        if (!Number.isFinite(n) || n < 0) return 0;
        return n;
    }
}
