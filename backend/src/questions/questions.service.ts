import { randomUUID } from "crypto";
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    OnModuleInit,
    Optional,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { QUESTION_HOLD_REASON, TicketGroupsService } from "../tickets/ticket-groups.service";
import { FollowsService } from "../follows/follows.service";
import { assertNoOffPlatformContact } from "../security/contact-leak";
import { sanitizeUserText } from "../security/sanitize-text";
import {
    collectBannedWords,
    findBannedWord,
    FLOOD_MS,
    MAX_ASKERS,
    MAX_PENDING_PER_USER,
    MAX_QUESTION_LEN,
    MIN_QUESTION_LEN,
    spamReason,
} from "./question-filters";
import {
    questionsSimilar,
    topicKeyFromText,
    viewerStatus,
    viewerStatusLabelHu,
} from "./question-rank";
import { isOpenQuestionStatus, planClusterResolution } from "./question-resolve";
import { advisoryXactLock } from "../db/advisory-lock";
import { WebrtcGateway } from "../webrtc-signaling/webrtc.gateway";

type Actor = { id: string; role?: string; email?: string };

@Injectable()
export class QuestionsService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly ticketGroups: TicketGroupsService,
        private readonly follows: FollowsService,
        @Optional() private readonly liveIo?: WebrtcGateway,
    ) {}

    async onModuleInit() {
        await this.ensureSchema();
    }

    async listApproved(showId?: string) {
        const id = this.requireShowId(showId);
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT COUNT(*)::int AS count FROM "Question"
            WHERE "showId" = ${id} AND status IN ('pending', 'approved')
        `;
        let current: { text: string; supportCount: number; questionCount: number } | null = null;
        try {
            const extra = await this.prisma.$queryRaw<{ liveQuestionTopicKey?: string | null }[]>`
                SELECT "liveQuestionTopicKey" FROM "Show" WHERE id = ${id}
            `;
            const cluster = await this.pickCluster(id, extra[0]?.liveQuestionTopicKey);
            if (cluster?.text) {
                current = {
                    text: cluster.text,
                    supportCount: cluster.supportCount,
                    questionCount: cluster.questionCount,
                };
            }
        } catch {
            current = null;
        }
        return {
            pendingCount: rows[0]?.count || 0,
            current,
        };
    }

    async listMine(userId: string, showId?: string) {
        const id = this.requireShowId(showId);
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT id, "showId", text, status, "filterReason", "createdAt"
            FROM "Question"
            WHERE "showId" = ${id} AND "userId" = ${userId}
            ORDER BY "createdAt" DESC
        `;
        return rows.map((row) => ({
            ...row,
            status: viewerStatus(row.status),
            statusLabel: viewerStatusLabelHu(row.status),
        }));
    }

    async listForModeration(showId?: string) {
        const id = this.requireShowId(showId);
        const questions = await this.prisma.$queryRaw<any[]>`
            SELECT q.id, q."showId", q."userId", q.text, q.status, q."filterReason", q."createdAt",
                   u.email AS "userEmail"
            FROM "Question" q
            JOIN "User" u ON u.id = q."userId"
            WHERE q."showId" = ${id}
            ORDER BY q."createdAt" DESC
        `;
        return {
            askerCount: await this.countAskers(id),
            maxAskers: MAX_ASKERS,
            questions: questions.map((q) => ({
                ...q,
                user: { id: q.userId, email: q.userEmail },
            })),
        };
    }

    async listAudit(showId?: string) {
        const id = this.requireShowId(showId);
        return this.prisma.$queryRaw<any[]>`
            SELECT a.id, a."questionId", a."showId", a.action, a."fromStatus", a."toStatus",
                   a.note, a."createdAt", a."actorUserId",
                   u.email AS "actorEmail",
                   q.text AS "questionText", q.status AS "questionStatus"
            FROM "QuestionAudit" a
            LEFT JOIN "User" u ON u.id = a."actorUserId"
            JOIN "Question" q ON q.id = a."questionId"
            WHERE a."showId" = ${id}
            ORDER BY a."createdAt" DESC
            LIMIT 200
        `.then((rows) =>
            rows.map((a) => ({
                id: a.id,
                action: a.action,
                fromStatus: a.fromStatus,
                toStatus: a.toStatus,
                note: a.note,
                createdAt: a.createdAt,
                actor: a.actorUserId ? { id: a.actorUserId, email: a.actorEmail } : null,
                question: { id: a.questionId, text: a.questionText, status: a.questionStatus },
            })),
        );
    }

    async listApprovedForStreamer(streamerId: string, showId?: string) {
        const wanted = showId?.trim();
        const shows = wanted
            ? await this.prisma.show.findMany({
                  where: { id: wanted, streamerId },
                  select: { id: true, title: true },
              })
            : await this.prisma.show.findMany({
                  where: { streamerId },
                  select: { id: true, title: true },
              });
        if (wanted && shows.length === 0) {
            throw new ForbiddenException("Csak a saját műsorod jóváhagyott kérdéseit látod.");
        }
        if (!shows.length) {
            return { showId: null, showTitle: null, current: null };
        }

        if (!wanted) {
            const live = await this.prisma.show.findFirst({
                where: { streamerId, live: true },
                orderBy: { updatedAt: "desc" },
                select: { id: true },
            });
            return this.currentForStreamer(streamerId, live?.id || shows[0].id);
        }
        return this.currentForStreamer(streamerId, wanted);
    }

    async addQuestion(userId: string, showId?: string, text?: string) {
        const body = sanitizeUserText(text, MAX_QUESTION_LEN);
        const id = showId?.trim();
        if (!id || !body) throw new BadRequestException("A showId és a kérdés szövege kötelező.");
        assertNoOffPlatformContact(body);
        if (body.length < MIN_QUESTION_LEN || body.length > MAX_QUESTION_LEN) {
            throw new BadRequestException(
                `A kérdés ${MIN_QUESTION_LEN}–${MAX_QUESTION_LEN} karakter lehet.`,
            );
        }

        const show = await this.prisma.show.findUnique({ where: { id } });
        if (!show) throw new NotFoundException("A műsor nem található.");
        if (!show.live) {
            const streamLive = await this.prisma.stream.findFirst({
                where: { showId: id, isLive: true },
                select: { id: true },
            }).catch(() => null);
            if (!streamLive) {
                throw new BadRequestException(
                    "Az élő adásnak vége. Új kérdés már nem küldhető; a jegyed megmarad.",
                );
            }
        }
        if (show.streamerId) {
            const host = await this.prisma.streamer.findUnique({
                where: { id: show.streamerId },
                select: { userId: true },
            });
            if (host?.userId === userId) {
                throw new BadRequestException(
                    "Saját adásra nem küldhetsz kérdést. Nyiss egy másik böngészőt vagy privát ablakot, és ott regisztrálj nézőként másik emaillel.",
                );
            }
        }

        await this.ticketGroups.assertCanAsk(userId, id);

        const lastRows = await this.prisma.$queryRaw<any[]>`
            SELECT "createdAt" FROM "Question"
            WHERE "showId" = ${id} AND "userId" = ${userId}
              AND status IN ('pending', 'approved')
            ORDER BY "createdAt" DESC
            LIMIT 1
        `;
        const last = lastRows[0];
        if (last && Date.now() - new Date(last.createdAt).getTime() < FLOOD_MS) {
            throw new BadRequestException("Túl gyorsan küldesz kérdést. Várj pár másodpercet.");
        }

        const askerCount = await this.countAskers(id);
        const mineActive = await this.prisma.$queryRaw<any[]>`
            SELECT COUNT(*)::int AS count FROM "Question"
            WHERE "showId" = ${id} AND "userId" = ${userId}
              AND status IN ('pending', 'approved')
        `;
        if ((mineActive[0]?.count || 0) === 0 && askerCount >= MAX_ASKERS) {
            throw new BadRequestException(
                `Egyszerre maximum ${MAX_ASKERS} kérdező lehet. Próbáld később.`,
            );
        }

        const dbWords = await this.listBannedWords();
        const banned = collectBannedWords(dbWords.map((w: any) => w.word));
        const hit = findBannedWord(body, banned);
        const spam = spamReason(body);

        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT id, text, "topicKey" FROM "Question"
            WHERE "showId" = ${id} AND status IN ('pending', 'approved')
        `;

        let status = "pending";
        let filterReason: string | null = null;
        if (hit) {
            status = "rejected";
            filterReason = "Tiltott szó.";
        } else if (spam) {
            status = "rejected";
            filterReason = spam;
        }

        const match = existing.find((row) => questionsSimilar(body, row.text));
        const topicKey =
            match?.topicKey || (match ? topicKeyFromText(match.text) : topicKeyFromText(body));
        if (match && !match.topicKey) {
            await this.prisma.$executeRaw`
                UPDATE "Question" SET "topicKey" = ${topicKey} WHERE id = ${match.id}
            `;
        }

        const questionId = randomUUID();
        if (status === "rejected") {
            const createdRows = await this.prisma.$queryRaw<any[]>`
                INSERT INTO "Question" (id, "showId", "userId", text, status, "filterReason", "topicKey", "createdAt")
                VALUES (${questionId}, ${id}, ${userId}, ${body}, ${status}, ${filterReason}, ${topicKey}, NOW())
                RETURNING id, "showId", text, status, "createdAt"
            `;
            const created = createdRows[0];
            await this.writeAudit({
                questionId: created.id,
                showId: id,
                actorUserId: userId,
                action: "auto_reject",
                fromStatus: null,
                toStatus: status,
                note: filterReason,
            });
            await this.notify(userId, "question_rejected", "Kérdés elutasítva", filterReason || "A szűrő elutasította.", created.id);
            throw new BadRequestException(filterReason || "A kérdést a szűrő elutasította.");
        }

        if (!show.streamerId) {
            throw new BadRequestException("Ehhez a műsorhoz nem tartozik tartalomkészítő.");
        }

        const created = await this.prisma.$transaction(async (tx) => {
            await advisoryXactLock(tx, `qpend:${userId}`, id);
            const pendingRows = await tx.$queryRaw<any[]>`
                SELECT COUNT(*)::int AS count FROM "Question"
                WHERE "showId" = ${id} AND "userId" = ${userId} AND status = 'pending'
            `;
            if ((pendingRows[0]?.count || 0) >= MAX_PENDING_PER_USER) {
                throw new BadRequestException("Már van függőben lévő kérdésed.");
            }
            const spent = await this.ticketGroups.spendOne(
                {
                    viewerUserId: userId,
                    streamerId: show.streamerId as string,
                    showId: id,
                    questionId,
                    reason: QUESTION_HOLD_REASON,
                },
                tx,
            );
            if (!spent) {
                throw new BadRequestException(
                    "Nincs felhasználható jegyed. Vásárolj jegycsomagot.",
                );
            }
            const createdRows = await tx.$queryRaw<any[]>`
                INSERT INTO "Question" (id, "showId", "userId", text, status, "filterReason", "topicKey", "createdAt")
                VALUES (${questionId}, ${id}, ${userId}, ${body}, ${status}, ${filterReason}, ${topicKey}, NOW())
                RETURNING id, "showId", text, status, "createdAt"
            `;
            const row = createdRows[0];
            await this.writeAudit(
                {
                    questionId: row.id,
                    showId: id,
                    actorUserId: userId,
                    action: "submit",
                    fromStatus: null,
                    toStatus: status,
                    note: filterReason,
                },
                tx,
            );
            return row;
        });

        await this.notify(
            userId,
            "question_pending",
            "Kérdés beküldve",
            "A kérdésed függőben van. A rendszer a hasonlókkal együtt rangsorolja.",
            created.id,
        );

        return {
            ...created,
            status: viewerStatus(created.status),
            statusLabel: viewerStatusLabelHu(created.status),
        };
    }

    async review(actor: Actor, id: string, status?: string, note?: string) {
        const next = String(status || "").trim().toLowerCase();
        if (next !== "rejected") {
            throw new BadRequestException("Moderátor csak elutasíthat. A teljesítést a tartalomkészítő gombja végzi.");
        }

        const updated = await this.prisma.$transaction(async (tx) => {
            const rows = await tx.$queryRaw<any[]>`
                SELECT * FROM "Question" WHERE id = ${id} FOR UPDATE
            `;
            const row = rows[0];
            if (!row) throw new NotFoundException("A kérdés nem található.");
            if (!isOpenQuestionStatus(row.status) || row.status === next) {
                return { row, userId: row.userId, skipped: true };
            }
            const reason = next === "rejected" ? note?.trim() || row.filterReason : null;
            const nextRows = await tx.$queryRaw<any[]>`
                UPDATE "Question"
                SET status = ${next},
                    "reviewedAt" = NOW(),
                    "reviewedById" = ${actor.id},
                    "filterReason" = ${reason}
                WHERE id = ${id} AND status IN ('pending', 'approved')
                RETURNING *
            `;
            if (!nextRows[0]) return { row, userId: row.userId, skipped: true };
            await this.ticketGroups.releaseQuestionHold({ questionId: id }, tx);
            await this.writeAudit(
                {
                    questionId: row.id,
                    showId: row.showId,
                    actorUserId: actor.id,
                    action: "reject",
                    fromStatus: row.status,
                    toStatus: next,
                    note: note?.trim() || null,
                },
                tx,
            );
            return { row: nextRows[0], userId: row.userId, skipped: false };
        });

        if (!updated.skipped) {
            await this.notify(
                updated.userId,
                "question_rejected",
                "Kérdés elutasítva",
                "A kérdésedet elutasították.",
                id,
            );
        }

        return updated.row;
    }

    async listQueueForStreamer(streamerId: string, showId?: string) {
        const show = await this.requireStreamerShow(streamerId, showId);
        return this.listForModeration(show.id);
    }

    async reviewForStreamer(streamerId: string, questionId: string, status?: string, note?: string) {
        const actor = await this.prisma.streamer.findUnique({
            where: { id: streamerId },
            select: { userId: true },
        });
        if (!actor?.userId) throw new ForbiddenException("A tartalomkészítő fiókhoz nincs felhasználó.");
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT q.id, s."streamerId"
            FROM "Question" q
            JOIN "Show" s ON s.id = q."showId"
            WHERE q.id = ${questionId}
            LIMIT 1
        `;
        const row = rows[0];
        if (!row) throw new NotFoundException("A kérdés nem található.");
        if (row.streamerId !== streamerId) {
            throw new ForbiddenException("Csak a saját műsorod kérdéseit utasíthatod el.");
        }
        return this.review({ id: actor.userId, role: "streamer" }, questionId, status, note);
    }

    async listBannedWords() {
        return this.prisma.$queryRaw<any[]>`
            SELECT id, word, "createdAt" FROM "BannedWord" ORDER BY word ASC
        `;
    }

    async addBannedWord(word?: string) {
        const value = String(word || "").trim().toLowerCase();
        if (value.length < 3) throw new BadRequestException("Legalább 3 karakter kell.");
        try {
            const rows = await this.prisma.$queryRaw<any[]>`
                INSERT INTO "BannedWord" (id, word, "createdAt")
                VALUES (${randomUUID()}, ${value}, NOW())
                RETURNING *
            `;
            return rows[0];
        } catch {
            throw new BadRequestException("Ez a szó már szerepel a listán.");
        }
    }

    async removeBannedWord(id: string) {
        await this.prisma.$executeRaw`DELETE FROM "BannedWord" WHERE id = ${id}`;
        return { deleted: true };
    }

    async currentForStreamer(streamerId: string, showId?: string) {
        const show = await this.requireStreamerShow(streamerId, showId);
        await this.backfillTopics(show.id);
        const cluster = await this.pickCluster(show.id, show.liveQuestionTopicKey);
        if (cluster && cluster.topicKey !== show.liveQuestionTopicKey) {
            await this.prisma.$executeRaw`
                UPDATE "Show" SET "liveQuestionTopicKey" = ${cluster.topicKey} WHERE id = ${show.id}
            `;
        }
        return {
            showId: show.id,
            showTitle: show.title,
            current: cluster,
        };
    }

    async fulfillCurrent(streamerId: string, showId?: string) {
        return this.resolveCurrent(streamerId, showId, "fulfilled");
    }

    async rejectCurrent(streamerId: string, showId?: string) {
        return this.resolveCurrent(streamerId, showId, "rejected");
    }

    /** Élő leállítás: megválaszolatlan kérdések „nem került sorra”, a foglalt jegy vissza. */
    async markUnansweredMissedOnLiveStop(showId: string) {
        const id = String(showId || "").trim();
        if (!id) return { updated: 0 };
        const reason = "Az élő adás véget ért, a kérdés nem került sorra.";
        const rows = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.$queryRaw<{ id: string; userId: string }[]>`
                UPDATE "Question"
                SET status = 'missed',
                    "reviewedAt" = NOW(),
                    "filterReason" = ${reason}
                WHERE "showId" = ${id} AND status IN ('pending', 'approved')
                RETURNING id, "userId"
            `.catch(() => [] as { id: string; userId: string }[]);
            const ids = updated.map((row) => row.id);
            if (ids.length) {
                await this.ticketGroups.releaseQuestionHold({ questionIds: ids }, tx);
            }
            await tx.$executeRaw`
                UPDATE "Show" SET "liveQuestionTopicKey" = NULL WHERE id = ${id}
            `.catch(() => undefined);
            return updated;
        });

        const seen = new Set<string>();
        for (const row of rows) {
            await this.writeAudit({
                questionId: row.id,
                showId: id,
                actorUserId: null,
                action: "missed_live_end",
                fromStatus: "pending",
                toStatus: "missed",
                note: reason,
            }).catch(() => undefined);
            if (seen.has(row.userId)) continue;
            seen.add(row.userId);
            await this.notify(
                row.userId,
                "question_missed",
                "Nem került sorra",
                "Az adás véget ért, a kérdésed nem került sorra. A jegyed megmaradt.",
                row.id,
            );
        }
        return { updated: rows.length };
    }

    async listNotifications(userId: string) {
        try {
            return await this.prisma.$queryRaw<any[]>`
                SELECT id, type, title, body, read, "relatedId", link, "createdAt"
                FROM "UserNotification"
                WHERE "userId" = ${userId}
                ORDER BY "createdAt" DESC
                LIMIT 40
            `;
        } catch {
            return [];
        }
    }

    async markNotificationRead(userId: string, id: string) {
        try {
            return await this.follows.recordOpen(userId, id);
        } catch {
            await this.prisma.$executeRaw`
                UPDATE "UserNotification" SET read = true WHERE id = ${id} AND "userId" = ${userId}
            `;
            return { ok: true };
        }
    }

    async addSupport(userId: string, showId?: string, kind?: string, text?: string, tickets?: number) {
        const id = this.requireShowId(showId);
        const show = await this.prisma.show.findUnique({ where: { id } });
        if (!show) throw new NotFoundException("A műsor nem található.");

        const k = String(kind || "").trim().toLowerCase();
        if (!["opinion", "feedback", "thanks", "support"].includes(k)) {
            throw new BadRequestException("Érvénytelen visszajelzés típus.");
        }
        const body = sanitizeUserText(text, 800);
        if (k !== "support" && body.length < 4) {
            throw new BadRequestException("Írj legalább néhány karaktert.");
        }
        assertNoOffPlatformContact(body);

        let spentTicket = false;
        let ticketsSpent = 0;
        const rowId = randomUUID();
        if (k === "support") {
            if (!show.live) {
                throw new BadRequestException("Támogatás csak élő adás alatt küldhető.");
            }
            if (!show.streamerId) {
                throw new BadRequestException("Ehhez a műsorhoz nem küldhető jegyes támogatás.");
            }
            ticketsSpent = Math.min(20, Math.max(1, Math.floor(Number(tickets) || 1)));
            const usable = await this.ticketGroups.assertCanAsk(userId, id);
            if (usable < ticketsSpent) {
                throw new BadRequestException(
                    `Nincs elég felhasználható jegyed. Ehhez a támogatáshoz ${ticketsSpent} jegy kell.`,
                );
            }
            await this.prisma.$transaction(async (tx) => {
                for (let i = 0; i < ticketsSpent; i++) {
                    const spent = await this.ticketGroups.spendOne(
                        {
                            viewerUserId: userId,
                            streamerId: show.streamerId as string,
                            showId: id,
                            reason: "support",
                        },
                        tx,
                    );
                    if (!spent) {
                        throw new BadRequestException(
                            "Nincs felhasználható jegyed. Vásárolj jegycsomagot.",
                        );
                    }
                }
                await tx.$executeRaw`
                    INSERT INTO "ShowSupport" (id, "showId", "userId", kind, text, "ticketsSpent", "createdAt")
                    VALUES (${rowId}, ${id}, ${userId}, ${k}, ${body || null}, ${ticketsSpent}, NOW())
                `;
            });
            spentTicket = true;
            let author = "Néző";
            try {
                const viewer = await this.prisma.user.findUnique({
                    where: { id: userId },
                    select: { username: true },
                });
                author = String(viewer?.username || "").trim() || "Néző";
            } catch {
                /* név nélkül is mehet az értesítés */
            }
            this.liveIo?.emitLiveSupport(id, {
                author,
                tickets: ticketsSpent,
            });
        } else {
            await this.prisma.$executeRaw`
                INSERT INTO "ShowSupport" (id, "showId", "userId", kind, text, "ticketsSpent", "createdAt")
                VALUES (${rowId}, ${id}, ${userId}, ${k}, ${body || null}, 0, NOW())
            `;
        }
        const wallet = spentTicket ? await this.ticketGroups.balance(userId, id).catch(() => null) : null;
        return {
            id: rowId,
            kind: k,
            spentTicket,
            ticketsSpent,
            ticketBalance: wallet ? Number(wallet.usableOnShow ?? wallet.balance) || 0 : undefined,
        };
    }

    async listSupportForStreamer(streamerId: string, showId?: string) {
        const show = await this.requireStreamerShow(streamerId, showId);
        try {
            const rows = await this.prisma.$queryRaw<any[]>`
                SELECT s.id, s.kind, s.text, s."ticketsSpent", s."createdAt", u.username AS "userName"
                FROM "ShowSupport" s
                JOIN "User" u ON u.id = s."userId"
                WHERE s."showId" = ${show.id}
                ORDER BY s."createdAt" DESC
                LIMIT 80
            `;
            return rows.map((r) => ({
                id: r.id,
                kind: r.kind,
                text: r.text,
                ticketsSpent: Number(r.ticketsSpent) || 0,
                createdAt: r.createdAt,
                author: String(r.userName || "").trim() || "Néző",
            }));
        } catch {
            return [];
        }
    }

    private async resolveCurrent(streamerId: string, showId: string | undefined, next: "fulfilled" | "rejected") {
        const show = await this.requireStreamerShow(streamerId, showId);
        const cluster = await this.pickCluster(show.id, show.liveQuestionTopicKey);
        if (!cluster) {
            throw new BadRequestException("Nincs aktuális kérdés.");
        }
        const ids = cluster.ids;
        if (!ids.length) throw new BadRequestException("Nincs aktuális kérdés.");

        const actor = await this.prisma.streamer.findUnique({ where: { id: streamerId } });
        const actorUserId = actor?.userId || null;

        const outcome = await this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw<any[]>`
                SELECT id, status, "userId" FROM "Question"
                WHERE id IN (${Prisma.join(ids)})
                FOR UPDATE
            `;
            const plan = planClusterResolution(locked, next);
            if (plan.noop) return { skipped: true, ids: [] as string[], userIds: [] as string[] };

            if (next === "fulfilled") {
                for (const uid of plan.userIds) {
                    if (!show.streamerId) continue;
                    const spent = await this.ticketGroups.captureQuestionTicket(
                        {
                            viewerUserId: uid,
                            streamerId: show.streamerId,
                            showId: show.id,
                            questionIds: plan.ids,
                        },
                        tx,
                    );
                    if (!spent) {
                        throw new BadRequestException(
                            "A kérdés nem teljesíthető: a nézőnek nincs felhasználható jegye.",
                        );
                    }
                }
            } else {
                await this.ticketGroups.releaseQuestionHold({ questionIds: plan.ids }, tx);
            }

            for (const qid of plan.ids) {
                const changed = await tx.$executeRaw`
                    UPDATE "Question"
                    SET status = ${next}, "reviewedAt" = NOW()
                    WHERE id = ${qid} AND status IN ('pending', 'approved')
                `;
                if (!changed) continue;
                await this.writeAudit(
                    {
                        questionId: qid,
                        showId: show.id,
                        actorUserId,
                        action: next === "fulfilled" ? "fulfill" : "reject",
                        fromStatus: "pending",
                        toStatus: next,
                        note: null,
                    },
                    tx,
                );
            }

            await tx.$executeRaw`
                UPDATE "Show" SET "liveQuestionTopicKey" = NULL WHERE id = ${show.id}
            `;
            return { skipped: false, ids: plan.ids, userIds: plan.userIds };
        });

        if (outcome.skipped) {
            const following = await this.currentForStreamer(streamerId, show.id);
            return { resolved: next, cluster, next: following.current, skipped: true };
        }

        if (next === "fulfilled") {
            for (const uid of outcome.userIds) {
                await this.notify(
                    uid,
                    "question_fulfilled",
                    "A kérdésed teljesült",
                    "A tartalomkészítő megválaszolta a kérdésedet (vagy a hasonló kérdések csoportját).",
                    cluster.ids[0],
                );
            }
        } else {
            for (const uid of outcome.userIds) {
                await this.notify(
                    uid,
                    "question_rejected",
                    "Kérdés elutasítva",
                    "A tartalomkészítő nem válaszol erre a kérdésre. A jegyed megmaradt.",
                    cluster.ids[0],
                );
            }
        }

        const following = await this.currentForStreamer(streamerId, show.id);
        return { resolved: next, cluster, next: following.current };
    }

    private async pickCluster(showId: string, pinnedKey?: string | null) {
        const pending = await this.prisma.$queryRaw<any[]>`
            SELECT id, "userId", text, "topicKey", "createdAt"
            FROM "Question"
            WHERE "showId" = ${showId} AND status IN ('pending', 'approved')
            ORDER BY "createdAt" ASC
        `;
        if (!pending.length) return null;

        const groups = new Map<string, any[]>();
        for (const row of pending) {
            const key = row.topicKey || topicKeyFromText(row.text);
            const list = groups.get(key) || [];
            list.push({ ...row, topicKey: key });
            groups.set(key, list);
        }

        const clusters = [...groups.entries()].map(([topicKey, rows]) => {
            const userIds = [...new Set(rows.map((r) => r.userId))];
            const representative = [...rows].sort((a, b) => b.text.length - a.text.length)[0];
            return {
                topicKey,
                text: representative.text,
                supportCount: userIds.length,
                questionCount: rows.length,
                ids: rows.map((r) => r.id),
                userIds,
                oldestAt: rows[0].createdAt,
            };
        });

        const merged: typeof clusters = [];
        for (const cluster of clusters) {
            const hit = merged.find((m) => questionsSimilar(m.text, cluster.text));
            if (!hit) {
                merged.push(cluster);
                continue;
            }
            hit.ids.push(...cluster.ids);
            hit.userIds = [...new Set([...hit.userIds, ...cluster.userIds])];
            hit.supportCount = hit.userIds.length;
            hit.questionCount += cluster.questionCount;
            if (new Date(cluster.oldestAt).getTime() < new Date(hit.oldestAt).getTime()) {
                hit.oldestAt = cluster.oldestAt;
            }
            if (cluster.text.length > hit.text.length) hit.text = cluster.text;
            for (const qid of cluster.ids) {
                await this.prisma.$executeRaw`
                    UPDATE "Question" SET "topicKey" = ${hit.topicKey} WHERE id = ${qid}
                `;
            }
        }

        merged.sort((a, b) => {
            if (b.supportCount !== a.supportCount) return b.supportCount - a.supportCount;
            return new Date(a.oldestAt).getTime() - new Date(b.oldestAt).getTime();
        });

        if (pinnedKey) {
            const pinned = merged.find((c) => c.topicKey === pinnedKey);
            if (pinned) return pinned;
        }
        return merged[0] || null;
    }

    private async backfillTopics(showId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT id, text, "topicKey" FROM "Question"
            WHERE "showId" = ${showId} AND status IN ('pending', 'approved')
        `;
        for (const row of rows) {
            if (row.topicKey) continue;
            const match = rows.find((o) => o.id !== row.id && o.topicKey && questionsSimilar(row.text, o.text));
            const key = match?.topicKey || topicKeyFromText(row.text);
            await this.prisma.$executeRaw`UPDATE "Question" SET "topicKey" = ${key} WHERE id = ${row.id}`;
            row.topicKey = key;
        }
    }

    private async requireStreamerShow(streamerId: string, showId?: string) {
        const wanted = showId?.trim();
        const show = wanted
            ? await this.prisma.show.findFirst({ where: { id: wanted, streamerId } })
            : await this.prisma.show.findFirst({
                  where: { streamerId, live: true },
                  orderBy: { updatedAt: "desc" },
              }) ||
              (await this.prisma.show.findFirst({
                  where: { streamerId },
                  orderBy: { updatedAt: "desc" },
              }));
        if (!show) throw new ForbiddenException("Nincs elérhető saját műsor.");
        const extra = await this.prisma.$queryRaw<any[]>`
            SELECT "liveQuestionTopicKey" FROM "Show" WHERE id = ${show.id}
        `;
        return {
            ...show,
            liveQuestionTopicKey: extra[0]?.liveQuestionTopicKey ?? null,
        };
    }

    private async notify(userId: string, type: string, title: string, body: string, relatedId?: string) {
        try {
            const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { locale: true } }).catch(() => null);
            const loc = (user as { locale?: string } | null)?.locale || "hu";
            const { translate } = await import("../i18n/messages");
            const titleKey = title === "Kérdés elutasítva" ? "notify.questionRejected" : "";
            const localizedTitle = titleKey ? translate(titleKey, loc) : title;
            await this.prisma.$executeRaw`
                INSERT INTO "UserNotification" (id, "userId", type, title, body, read, "relatedId", "createdAt")
                VALUES (${randomUUID()}, ${userId}, ${type}, ${localizedTitle}, ${body}, false, ${relatedId || null}, NOW())
            `;
        } catch {
            /* table may not exist until migrate */
        }
    }

    private async ensureSchema() {
        const stmts = [
            `ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "topicKey" TEXT`,
            `ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "liveQuestionTopicKey" TEXT`,
            `ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "questionRedeemedAt" TIMESTAMP(3)`,
            `CREATE TABLE IF NOT EXISTS "UserNotification" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "userId" TEXT NOT NULL,
                "type" TEXT NOT NULL,
                "title" TEXT NOT NULL,
                "body" TEXT NOT NULL,
                "read" BOOLEAN NOT NULL DEFAULT false,
                "relatedId" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS "ShowSupport" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "showId" TEXT NOT NULL,
                "userId" TEXT NOT NULL,
                "kind" TEXT NOT NULL,
                "text" TEXT,
                "ticketsSpent" INTEGER NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
            `ALTER TABLE "ShowSupport" ADD COLUMN IF NOT EXISTS "ticketsSpent" INTEGER NOT NULL DEFAULT 0`,
            `UPDATE "Question" SET status = 'pending' WHERE status = 'approved'`,
        ];
        for (const sql of stmts) {
            await this.prisma.$executeRawUnsafe(sql).catch(() => undefined);
        }
    }

    private requireShowId(showId?: string) {
        const id = showId?.trim();
        if (!id) throw new BadRequestException("A showId kötelező.");
        return id;
    }

    private async countAskers(showId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT COUNT(DISTINCT "userId")::int AS count
            FROM "Question"
            WHERE "showId" = ${showId} AND status IN ('pending', 'approved')
        `;
        return rows[0]?.count || 0;
    }

    private writeAudit(
        data: {
            questionId: string;
            showId: string;
            actorUserId: string | null;
            action: string;
            fromStatus: string | null;
            toStatus: string;
            note: string | null;
        },
        db: { $executeRaw: PrismaService["$executeRaw"] } = this.prisma,
    ) {
        return db.$executeRaw`
            INSERT INTO "QuestionAudit"
                (id, "questionId", "showId", "actorUserId", action, "fromStatus", "toStatus", note, "createdAt")
            VALUES (
                ${randomUUID()},
                ${data.questionId},
                ${data.showId},
                ${data.actorUserId},
                ${data.action},
                ${data.fromStatus},
                ${data.toStatus},
                ${data.note},
                NOW()
            )
        `;
    }
}
