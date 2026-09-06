import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
    isTicketCategoryKey,
    showTicketOfferDb,
    ticketCategoryDb,
} from "./ticket-categories";

@Injectable()
export class TicketCategoriesService {
    constructor(private readonly prisma: PrismaService) {}

    list() {
        return ticketCategoryDb(this.prisma).findMany({
            orderBy: { sortOrder: "asc" },
        });
    }

    async updatePrices(items?: { key?: string; price?: number }[]) {
        if (!Array.isArray(items) || items.length === 0) {
            throw new BadRequestException("A kategóriaárak listája kötelező.");
        }

        for (const item of items) {
            const key = String(item.key || "").trim();
            const price = Math.round(Number(item.price));
            if (!isTicketCategoryKey(key)) {
                throw new BadRequestException(`Ismeretlen jegykategória: ${key}`);
            }
            if (!Number.isFinite(price) || price < 0) {
                throw new BadRequestException("Az ár nem lehet negatív.");
            }
            await ticketCategoryDb(this.prisma).update({
                where: { key },
                data: { price },
            });
        }

        await this.syncAllShowPrices();
        return this.list();
    }

    async getByKey(key?: string) {
        const value = String(key || "").trim();
        if (!isTicketCategoryKey(value)) {
            throw new BadRequestException("Érvénytelen jegykategória.");
        }
        const row = await ticketCategoryDb(this.prisma).findUnique({ where: { key: value } });
        if (!row) throw new NotFoundException("A jegykategória nem található.");
        return row;
    }

    async setShowCategories(showId: string, keys?: string[]) {
        const wanted = Array.isArray(keys)
            ? [...new Set(keys.map((k) => String(k).trim()).filter(Boolean))]
            : [];
        if (wanted.length === 0) {
            throw new BadRequestException("Legalább egy jegykategóriát ki kell választani.");
        }
        for (const key of wanted) {
            if (!isTicketCategoryKey(key)) {
                throw new BadRequestException(`A streamer nem adhat meg saját jegytípust: ${key}`);
            }
        }

        const categories = await ticketCategoryDb(this.prisma).findMany({
            where: { key: { in: wanted } },
        });
        if (categories.length !== wanted.length) {
            throw new BadRequestException("Ismeretlen jegykategória.");
        }

        await showTicketOfferDb(this.prisma).deleteMany({ where: { showId } });
        await showTicketOfferDb(this.prisma).createMany({
            data: categories.map((c: { id: string }) => ({
                showId,
                categoryId: c.id,
            })),
        });

        await this.syncShowPrice(showId);
        return this.offersForShow(showId);
    }

    async offersForShow(showId: string) {
        const offers = await showTicketOfferDb(this.prisma).findMany({
            where: { showId },
            include: { category: true },
        });
        return offers
            .map((o: any) => o.category)
            .filter(Boolean)
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
            .map((c: any) => ({
                id: c.id,
                key: c.key,
                name: c.name,
                price: c.price,
            }));
    }

    async assertOffered(showId: string, categoryKey: string) {
        const category = await this.getByKey(categoryKey);
        const offer = await showTicketOfferDb(this.prisma).findUnique({
            where: {
                showId_categoryId: { showId, categoryId: category.id },
            },
        });
        if (!offer) {
            throw new BadRequestException("Ez a jegykategória ennél a műsornál nem elérhető.");
        }
        return category;
    }

    async syncShowPrice(showId: string) {
        await this.prisma.show.update({ where: { id: showId }, data: { price: 0 } });
        return 0;
    }

    private async syncAllShowPrices() {
        const shows = await this.prisma.show.findMany({ select: { id: true } });
        for (const show of shows) {
            await this.syncShowPrice(show.id);
        }
    }
}
