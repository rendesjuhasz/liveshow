import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { FollowNotifyService } from "../follows/follow-notify.service";
import { publicAuthorName } from "../wishes/wish-status";
import { assertNoOffPlatformContact } from "../security/contact-leak";
import { setShowVideoCategory } from "../shows/video-category-db";
import { getArchiveFile, getRecordingFile } from "../streaming/hls-paths";
import {
    BACKUP_DAYS,
    PRIVATE_DEADLINES,
    backupRoot,
    ensureBackupDir,
    ensurePrivateSchema,
    newId,
    starCategory,
} from "./private-schema";

type StreamerReq = { id: string; name: string; userId?: string | null; avatarUrl?: string | null };

@Injectable()
export class PrivateStreamsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly payments: PaymentsService,
        private readonly followNotify: FollowNotifyService,
    ) {}

    meta() {
        return {
            deadlines: PRIVATE_DEADLINES,
            backupDays: BACKUP_DAYS,
            notice:
                "A privát adásról biztonsági mentés készül, amelyet az admin 30 napig őriz. A felvétel nem kerül ki a nyilvános oldalra. E-mail, telefonszám és külső chat nem osztható meg: a kapcsolat a platformon marad.",
        };
    }

    async bands() {
        await ensurePrivateSchema(this.prisma);
        return this.prisma.$queryRaw<any[]>`
            SELECT stars, "minPrice", "maxPrice" FROM "PrivatePriceBand" ORDER BY stars
        `;
    }

    async saveBands(items: { stars: number; minPrice: number; maxPrice: number }[]) {
        await ensurePrivateSchema(this.prisma);
        if (!Array.isArray(items) || items.length !== 5) {
            throw new BadRequestException("Mind az 5 csillagkategóriát meg kell adni.");
        }
        for (const item of items) {
            const stars = Math.round(Number(item.stars));
            const minPrice = Math.round(Number(item.minPrice));
            const maxPrice = Math.round(Number(item.maxPrice));
            if (stars < 1 || stars > 5) throw new BadRequestException("A kategória 1–5 csillag lehet.");
            if (minPrice < 0 || maxPrice < minPrice) {
                throw new BadRequestException("Érvénytelen ársáv.");
            }
            await this.prisma.$executeRaw`
                INSERT INTO "PrivatePriceBand" ("stars", "minPrice", "maxPrice")
                VALUES (${stars}, ${minPrice}, ${maxPrice})
                ON CONFLICT ("stars") DO UPDATE SET "minPrice" = ${minPrice}, "maxPrice" = ${maxPrice}
            `;
        }
        return this.bands();
    }

    async createRequest(
        userId: string,
        body: { topic?: string; details?: string; deadlineHours?: number },
    ) {
        await ensurePrivateSchema(this.prisma);
        const topic = String(body.topic || "").trim();
        const details = String(body.details || "").trim();
        const hours = Number(body.deadlineHours);
        if (topic.length < 3) throw new BadRequestException("Add meg a témát.");
        if (details.length < 8) throw new BadRequestException("A részlet legalább 8 karakter legyen.");
        if (!PRIVATE_DEADLINES.some((d) => d.hours === hours)) {
            throw new BadRequestException("Érvénytelen határidő.");
        }
        assertNoOffPlatformContact(topic, details);
        const id = newId();
        const deadlineAt = new Date(Date.now() + hours * 3600_000);
        await this.prisma.$executeRaw`
            INSERT INTO "PrivateRequest"
                ("id", "userId", "topic", "details", "deadlineHours", "deadlineAt", "status")
            VALUES (${id}, ${userId}, ${topic}, ${details}, ${hours}, ${deadlineAt}, 'open')
        `;
        return this.getRequest(id, { userId, role: "viewer" });
    }

    async listMine(userId: string) {
        await this.expireOpen();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT r.*, u.name AS "userName"
            FROM "PrivateRequest" r
            JOIN "User" u ON u.id = r."userId"
            WHERE r."userId" = ${userId}
            ORDER BY r."createdAt" DESC
        `;
        return Promise.all(rows.map((row) => this.decorateRequest(row, { userId, role: "viewer" })));
    }

    async listOpenForStreamers() {
        await this.expireOpen();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT r.*, u.name AS "userName"
            FROM "PrivateRequest" r
            JOIN "User" u ON u.id = r."userId"
            WHERE r.status = 'open' AND r."deadlineAt" > NOW()
            ORDER BY r."createdAt" DESC
        `;
        return rows.map((row) => ({
            id: row.id,
            topic: row.topic,
            details: row.details,
            deadlineHours: row.deadlineHours,
            deadlineAt: row.deadlineAt,
            status: row.status,
            createdAt: row.createdAt,
            authorName: publicAuthorName({ name: row.userName }),
        }));
    }

    async getRequest(
        id: string,
        actor: { userId: string; role: "viewer" | "streamer" | "admin"; streamerId?: string },
    ) {
        await this.expireOpen();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT r.*, u.name AS "userName", u.email AS "userEmail"
            FROM "PrivateRequest" r
            JOIN "User" u ON u.id = r."userId"
            WHERE r.id = ${id}
            LIMIT 1
        `;
        const row = rows[0];
        if (!row) throw new NotFoundException("A privát kívánság nem található.");
        if (actor.role === "viewer" && row.userId !== actor.userId) {
            throw new ForbiddenException("Ez nem a te kívánságod.");
        }
        return this.decorateRequest(row, actor);
    }

    async apply(
        requestId: string,
        streamer: StreamerReq,
        body: { plan?: string; price?: number; proposedStarts?: string[] },
    ) {
        await ensurePrivateSchema(this.prisma);
        const request = await this.requireOpen(requestId);
        const plan = String(body.plan || "").trim();
        if (plan.length < 8) throw new BadRequestException("Írd le, hogyan valósítanád meg a műsort.");
        assertNoOffPlatformContact(plan);
        const starts = (Array.isArray(body.proposedStarts) ? body.proposedStarts : [])
            .map((v) => new Date(String(v)))
            .filter((d) => !Number.isNaN(d.getTime()));
        if (!starts.length) throw new BadRequestException("Adj meg legalább egy lehetséges időpontot.");
        if (starts.length > 5) throw new BadRequestException("Legfeljebb 5 időpont adható.");
        const deadline = new Date(request.deadlineAt);
        if (starts.some((d) => d.getTime() > deadline.getTime() + 24 * 3600_000)) {
            throw new BadRequestException("Az időpontnak a megadott határidőn belül kell lennie.");
        }

        const rating = await this.streamerRating(streamer.id);
        const stars = starCategory(rating.average);
        const band = await this.bandFor(stars);
        const price = Math.round(Number(body.price));
        if (!Number.isFinite(price) || price < band.minPrice || price > band.maxPrice) {
            throw new BadRequestException(
                `Az ár a ${stars} csillagos sávban ${band.minPrice}–${band.maxPrice} Ft lehet.`,
            );
        }

        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "PrivateOffer" WHERE "requestId" = ${requestId} AND "streamerId" = ${streamer.id}
        `;
        const proposedStarts = JSON.stringify(starts.map((d) => d.toISOString()));
        if (existing[0]) {
            await this.prisma.$executeRaw`
                UPDATE "PrivateOffer"
                SET plan = ${plan}, price = ${price}, "proposedStarts" = ${proposedStarts},
                    "starCategory" = ${stars}, status = 'pending'
                WHERE id = ${existing[0].id}
            `;
            return this.getRequest(requestId, {
                userId: streamer.userId || "",
                role: "streamer",
                streamerId: streamer.id,
            });
        }
        const id = newId();
        await this.prisma.$executeRaw`
            INSERT INTO "PrivateOffer"
                ("id", "requestId", "streamerId", plan, price, "proposedStarts", "starCategory", status)
            VALUES (${id}, ${requestId}, ${streamer.id}, ${plan}, ${price}, ${proposedStarts}, ${stars}, 'pending')
        `;
        return this.getRequest(requestId, {
            userId: streamer.userId || "",
            role: "streamer",
            streamerId: streamer.id,
        });
    }

    async selectOffer(userId: string, requestId: string, offerId: string, startAt?: string) {
        const request = await this.requireOwner(requestId, userId);
        if (request.status !== "open" && request.status !== "awarded") {
            throw new BadRequestException("Erre a kívánságra már nem lehet ajánlatot választani.");
        }
        const offers = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "PrivateOffer" WHERE id = ${offerId} AND "requestId" = ${requestId}
        `;
        const offer = offers[0];
        if (!offer || offer.status === "closed") {
            throw new NotFoundException("Az ajánlat nem található.");
        }
        const slots: string[] = JSON.parse(offer.proposedStarts || "[]");
        const wanted = startAt ? new Date(startAt).getTime() : NaN;
        const chosen =
            slots.find((slot) => slot === startAt) ||
            slots.find((slot) => new Date(slot).getTime() === wanted) ||
            slots[0];
        if (!chosen) throw new BadRequestException("Nincs választható időpont.");

        await this.prisma.$executeRaw`
            UPDATE "PrivateRequest"
            SET status = 'awarded', "selectedOfferId" = ${offerId}, "selectedStart" = ${new Date(chosen)}
            WHERE id = ${requestId}
        `;
        await this.prisma.$executeRaw`
            UPDATE "PrivateOffer" SET status = 'selected' WHERE id = ${offerId}
        `;

        return this.checkout(userId, requestId);
    }

    async checkout(userId: string, requestId: string) {
        await ensurePrivateSchema(this.prisma);
        const request = await this.requireOwner(requestId, userId);
        if (!request.selectedOfferId) {
            throw new BadRequestException("Előbb válassz egy ajánlatot.");
        }
        const offers = await this.prisma.$queryRaw<any[]>`
            SELECT o.*, s.name AS "streamerName", s."userId" AS "streamerUserId"
            FROM "PrivateOffer" o
            JOIN "Streamer" s ON s.id = o."streamerId"
            WHERE o.id = ${request.selectedOfferId}
        `;
        const offer = offers[0];
        if (!offer) throw new NotFoundException("A kiválasztott ajánlat hiányzik.");

        let showId = request.showId as string | null;
        let ticketId = request.ticketId as string | null;
        const startTime = request.selectedStart ? new Date(request.selectedStart) : new Date();
        if (!showId) {
            const streamId = `priv-${randomBytes(4).toString("hex")}`;
            const show = await this.prisma.show.create({
                data: {
                    title: `Privát: ${request.topic}`,
                    description: request.details,
                    startTime,
                    price: offer.price,
                    live: false,
                    featured: false,
                    status: "active",
                    streamId,
                    privateStreamId: streamId,
                    streamerId: offer.streamerId,
                } as any,
            });
            showId = show.id;
            await this.prisma.$executeRaw`
                UPDATE "Show"
                SET "isPrivate" = true, "privateStreamId" = ${streamId}, "featured" = false
                WHERE id = ${showId}
            `;
            await setShowVideoCategory(this.prisma, showId, "egyeb");
            await this.prisma.$executeRaw`
                UPDATE "PrivateRequest" SET "showId" = ${showId} WHERE id = ${requestId}
            `;
        }

        if (!ticketId) {
            const ticket = await this.prisma.ticket.create({
                data: {
                    userId,
                    showId: showId!,
                    price: offer.price,
                    status: "pending",
                },
            });
            ticketId = ticket.id;
            await this.prisma.$executeRaw`
                UPDATE "PrivateRequest" SET "ticketId" = ${ticketId} WHERE id = ${requestId}
            `;
        } else {
            await this.prisma.ticket.update({
                where: { id: ticketId },
                data: { price: offer.price, showId: showId! },
            });
        }

        const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId! } });
        if (!ticket) throw new NotFoundException("A privát jegy nem jött létre.");
        const pay = await this.payments.createForTicket({
            id: ticket.id,
            userId: ticket.userId,
            showId: ticket.showId,
            price: ticket.price,
        });
        await this.syncPaid(ticket.id);
        return {
            requestId,
            ticketId: ticket.id,
            checkoutUrl: pay.checkoutUrl,
            devPay: pay.devPay,
            paymentId: pay.payment?.id,
            notice: this.meta().notice,
        };
    }

    async syncPaid(ticketId: string) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket || ticket.status !== "active") return;
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "PrivateRequest" WHERE "ticketId" = ${ticketId} LIMIT 1
        `;
        const request = rows[0];
        if (!request) return;
        await this.prisma.$executeRaw`
            UPDATE "PrivateRequest" SET status = 'paid' WHERE id = ${request.id}
        `;
        if (ticket.showId) {
            void this.followNotify.notifyPublished(ticket.showId).catch(() => undefined);
        }
        if (request.selectedOfferId) {
            await this.prisma.$executeRaw`
                UPDATE "PrivateOffer"
                SET status = 'closed'
                WHERE "requestId" = ${request.id} AND id <> ${request.selectedOfferId}
            `;
        }
    }

    async watch(userId: string, requestId: string, isAdmin = false) {
        const request = (
            await this.prisma.$queryRaw<any[]>`SELECT * FROM "PrivateRequest" WHERE id = ${requestId} LIMIT 1`
        )[0];
        if (!request) throw new NotFoundException("A privát stream nem található.");
        const show = request.showId
            ? await this.prisma.show.findUnique({
                  where: { id: request.showId },
                  include: { streamer: true },
              })
            : null;
        const streamerUserId = show?.streamer?.userId;
        const isOwner = request.userId === userId;
        const isStreamer = streamerUserId === userId;
        if (!isAdmin && !isOwner && !isStreamer) {
            throw new ForbiddenException("Ez a privát adás nem neked szól.");
        }
        if (!isAdmin && !isStreamer && request.status !== "paid") {
            throw new ForbiddenException("A privát stream a jegy megvásárlása után érhető el.");
        }
        return {
            requestId,
            showId: request.showId,
            title: show?.title || request.topic,
            streamId: show?.streamId || show?.privateStreamId || "",
            startTime: request.selectedStart || show?.startTime,
            live: Boolean(show?.live),
            role: isStreamer ? "streamer" : isOwner ? "viewer" : "admin",
            notice: this.meta().notice,
            canWatch: true,
        };
    }

    async captureBackup(showId: string) {
        await ensurePrivateSchema(this.prisma);
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "PrivateRequest" WHERE "showId" = ${showId} LIMIT 1
        `;
        const request = rows[0];
        if (!request) return null;
        const show = await this.prisma.show.findUnique({ where: { id: showId } });
        const streamId = show?.streamId || show?.privateStreamId;
        if (!streamId) return null;
        const source = [getRecordingFile(streamId), getArchiveFile(streamId)].find((p) =>
            fs.existsSync(p),
        );
        if (!source) return null;
        ensureBackupDir();
        const dest = path.join(backupRoot(), `${request.id}.mp4`);
        fs.copyFileSync(source, dest);
        const expiresAt = new Date(Date.now() + BACKUP_DAYS * 24 * 3600_000);
        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "PrivateBackup" WHERE "requestId" = ${request.id} LIMIT 1
        `;
        if (existing[0]) {
            await this.prisma.$executeRaw`
                UPDATE "PrivateBackup"
                SET "filePath" = ${dest}, "expiresAt" = ${expiresAt}, "showId" = ${showId}
                WHERE id = ${existing[0].id}
            `;
        } else {
            await this.prisma.$executeRaw`
                INSERT INTO "PrivateBackup" ("id", "requestId", "showId", "filePath", "expiresAt")
                VALUES (${newId()}, ${request.id}, ${showId}, ${dest}, ${expiresAt})
            `;
        }
        return { requestId: request.id, filePath: dest, expiresAt };
    }

    async listBackups() {
        await ensurePrivateSchema(this.prisma);
        await this.purgeExpiredBackups();
        return this.prisma.$queryRaw<any[]>`
            SELECT b.*, r.topic, r."userId"
            FROM "PrivateBackup" b
            JOIN "PrivateRequest" r ON r.id = b."requestId"
            ORDER BY b."createdAt" DESC
        `;
    }

    async backupFile(id: string) {
        await this.purgeExpiredBackups();
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT * FROM "PrivateBackup" WHERE id = ${id} LIMIT 1
        `;
        const row = rows[0];
        if (!row || new Date(row.expiresAt).getTime() < Date.now()) {
            throw new NotFoundException("A biztonsági mentés nem elérhető.");
        }
        if (!fs.existsSync(row.filePath)) {
            throw new NotFoundException("A fájl már nincs a lemezen.");
        }
        return row;
    }

    async bandForStreamer(streamerId: string) {
        const rating = await this.streamerRating(streamerId);
        const stars = starCategory(rating.average);
        const band = await this.bandFor(stars);
        return { ...band, stars, average: rating.average, count: rating.count };
    }

    private async decorateRequest(
        row: any,
        actor: { userId: string; role: string; streamerId?: string },
    ) {
        const offers = await this.offersFor(row.id, actor);
        const deadline = PRIVATE_DEADLINES.find((d) => d.hours === row.deadlineHours);
        return {
            id: row.id,
            topic: row.topic,
            details: row.details,
            deadlineHours: row.deadlineHours,
            deadlineLabel: deadline?.label || `${row.deadlineHours} óra`,
            deadlineAt: row.deadlineAt,
            status: row.status,
            selectedOfferId: row.selectedOfferId,
            selectedStart: row.selectedStart,
            showId: row.showId,
            ticketId: row.ticketId,
            createdAt: row.createdAt,
            authorName: publicAuthorName({ name: row.userName }),
            ...(actor.role === "admin" && row.userEmail ? { viewerEmail: row.userEmail } : {}),
            offerCount: offers.length,
            offers,
            notice: this.meta().notice,
        };
    }

    private async offersFor(requestId: string, actor: { role: string; streamerId?: string }) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT o.*, s.name AS "streamerName", s."avatarUrl"
            FROM "PrivateOffer" o
            JOIN "Streamer" s ON s.id = o."streamerId"
            WHERE o."requestId" = ${requestId}
            ORDER BY o."createdAt" ASC
        `;
        const ratings = await this.ratingsMap(rows.map((r) => r.streamerId));
        return rows
            .filter((row) => actor.role !== "streamer" || row.streamerId === actor.streamerId)
            .map((row) => {
                const rating = ratings.get(row.streamerId) || { average: 0, count: 0 };
                return {
                    id: row.id,
                    streamerId: row.streamerId,
                    streamerName: row.streamerName,
                    avatarUrl: row.avatarUrl,
                    plan: actor.role === "viewer" || actor.role === "admin" ? row.plan : row.plan,
                    price: row.price,
                    proposedStarts: JSON.parse(row.proposedStarts || "[]"),
                    starCategory: row.starCategory,
                    rating: rating.average,
                    reviewCount: rating.count,
                    status: row.status,
                    createdAt: row.createdAt,
                };
            });
    }

    private async ratingsMap(ids: string[]) {
        const map = new Map<string, { average: number; count: number }>();
        if (!ids.length) return map;
        for (const id of ids) {
            map.set(id, await this.streamerRating(id));
        }
        return map;
    }

    private async streamerRating(streamerId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT ROUND(AVG(r.rating)::numeric, 1) AS average, COUNT(*)::int AS count
            FROM "Review" r
            JOIN "Show" s ON s.id = r."showId"
            WHERE s."streamerId" = ${streamerId}
              AND COALESCE(r.status, 'approved') = 'approved'
        `;
        return { average: Number(rows[0]?.average) || 0, count: Number(rows[0]?.count) || 0 };
    }

    private async bandFor(stars: number) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT stars, "minPrice", "maxPrice" FROM "PrivatePriceBand" WHERE stars = ${stars} LIMIT 1
        `;
        if (!rows[0]) throw new BadRequestException("Nincs ársáv ehhez a kategóriához.");
        return {
            stars: Number(rows[0].stars),
            minPrice: Number(rows[0].minPrice),
            maxPrice: Number(rows[0].maxPrice),
        };
    }

    private async requireOpen(id: string) {
        const rows = await this.prisma.$queryRaw<any[]>`SELECT * FROM "PrivateRequest" WHERE id = ${id} LIMIT 1`;
        const row = rows[0];
        if (!row) throw new NotFoundException("A privát kívánság nem található.");
        if (row.status !== "open") throw new BadRequestException("Ez a kívánság már nem fogad ajánlatot.");
        if (new Date(row.deadlineAt).getTime() < Date.now()) {
            await this.prisma.$executeRaw`UPDATE "PrivateRequest" SET status = 'expired' WHERE id = ${id}`;
            throw new BadRequestException("A jelentkezési határidő lejárt.");
        }
        return row;
    }

    private async requireOwner(id: string, userId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`SELECT * FROM "PrivateRequest" WHERE id = ${id} LIMIT 1`;
        const row = rows[0];
        if (!row) throw new NotFoundException("A privát kívánság nem található.");
        if (row.userId !== userId) throw new ForbiddenException("Ez nem a te kívánságod.");
        return row;
    }

    private async expireOpen() {
        await ensurePrivateSchema(this.prisma);
        await this.prisma.$executeRaw`
            UPDATE "PrivateRequest" SET status = 'expired'
            WHERE status = 'open' AND "deadlineAt" < NOW()
        `;
    }

    private async purgeExpiredBackups() {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT id, "filePath" FROM "PrivateBackup" WHERE "expiresAt" < NOW()
        `;
        for (const row of rows) {
            try {
                if (fs.existsSync(row.filePath)) fs.unlinkSync(row.filePath);
            } catch {
                /* ignore */
            }
            await this.prisma.$executeRaw`DELETE FROM "PrivateBackup" WHERE id = ${row.id}`;
        }
    }
}
