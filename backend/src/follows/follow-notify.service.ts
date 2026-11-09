import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { FollowsService, type NotifyPrefs } from "./follows.service";
import { ensureFollowSchema, FOLLOW_NOTIFY, type FollowNotifyKind } from "./follow-schema";
import { followShowEmail } from "../mail/mail.templates";
import { formatInTimeZone } from "../time/timezone";

type Recipient = {
    userId: string;
    email: string;
    locale: string;
    timezone?: string | null;
    prefs: NotifyPrefs;
};

@Injectable()
export class FollowNotifyService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(FollowNotifyService.name);
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly follows: FollowsService,
        private readonly mail: MailService,
    ) {}

    async onModuleInit() {
        await ensureFollowSchema(this.prisma);
        await this.prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT`,
        ).catch(() => undefined);
        this.timer = setInterval(() => {
            this.tickReminders().catch((err) =>
                this.logger.warn(`Emlékeztető hiba: ${err?.message || err}`),
            );
        }, 60_000);
        this.tickReminders().catch(() => undefined);
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }

    notifyPublished(showId: string) {
        return this.dispatch(showId, FOLLOW_NOTIFY.newShow);
    }

    notifyGoingLive(showId: string) {
        return this.dispatch(showId, FOLLOW_NOTIFY.goingLive);
    }

    async tickReminders() {
        const now = Date.now();
        const shows = await this.prisma.show.findMany({
            where: {
                startTime: {
                    gte: new Date(now - 30 * 60_000),
                    lte: new Date(now + 26 * 60 * 60_000),
                },
            },
            select: { id: true, startTime: true, live: true, status: true },
        });
        for (const show of shows) {
            if (show.live || String(show.status || "") === "archived" || String(show.status || "") === "missed") continue;
            const start = show.startTime ? new Date(show.startTime).getTime() : 0;
            if (!start || start <= now) continue;
            const hours = (start - now) / 3_600_000;
            if (hours <= 25 && hours >= 23) {
                await this.dispatch(show.id, FOLLOW_NOTIFY.reminder24h);
            }
            if (hours <= 2.15 && hours >= 1.85) {
                await this.dispatch(show.id, FOLLOW_NOTIFY.reminder2h);
            }
            if (hours <= 1.25 && hours >= 0.75) {
                await this.dispatch(show.id, FOLLOW_NOTIFY.reminder1h);
            }
            if (hours <= 0.6 && hours >= 0.4) {
                await this.dispatch(show.id, FOLLOW_NOTIFY.reminder30m);
            }
        }
    }

    private async dispatch(showId: string, kind: FollowNotifyKind) {
        const show = await this.prisma.show.findUnique({
            where: { id: showId },
            include: {
                streamer: {
                    select: {
                        id: true,
                        name: true,
                        userId: true,
                        user: { select: { username: true } },
                    },
                },
            },
        });
        if (!show?.streamerId || !show.streamer) return;
        const status = String((show as any).status || "active");
        if (status === "draft" || status === "blocked" || status === "pending") return;

        const privateFlag = await this.isPrivate(show.id);
        const recipients = privateFlag
            ? await this.privateBuyer(show.id)
            : await this.followersOf(show.streamerId);

        const filtered = recipients.filter((r) => r.userId !== show.streamer?.userId);
        if (filtered.length === 0) return;

        const streamerName =
            String(show.streamer.user?.username || "").trim() || "Tartalomkészítő";
        const href = privateFlag ? `/profile?tab=private` : liveOrShowHref(kind, show.id);

        let sent = 0;
        for (const rec of filtered) {
            const prefs = rec.prefs;
            if (!this.follows.prefAllows(prefs, kind)) continue;
            const when = formatWhen(show.startTime, rec.timezone || rec.locale);
            const copy = messageFor(kind, streamerName, show.title, when, privateFlag);
            const inApp = await this.insertNote(rec.userId, kind, copy.title, copy.body, show.id, href);
            if (inApp) sent += 1;
            if (prefs.emailEnabled && rec.email) {
                const tpl = followShowEmail(copy.title, copy.body, href, rec.locale || "hu");
                void this.mail.queueFollow({
                    to: rec.email,
                    ...tpl,
                    relatedId: `${kind}:${show.id}:${rec.userId}`,
                });
            }
        }
        await this.follows.bumpSent(show.id, kind, sent);
    }

    private async insertNote(
        userId: string,
        type: string,
        title: string,
        body: string,
        relatedId: string,
        link: string,
    ) {
        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "UserNotification"
            WHERE "userId" = ${userId} AND type = ${type} AND COALESCE("relatedId", '') = ${relatedId}
            LIMIT 1
        `;
        if (existing[0]) return false;
        await this.prisma.$executeRaw`
            INSERT INTO "UserNotification" (id, "userId", type, title, body, read, "relatedId", link, clicked, "createdAt")
            VALUES (${randomUUID()}, ${userId}, ${type}, ${title}, ${body}, false, ${relatedId}, ${link}, false, NOW())
        `;
        return true;
    }

    private async isPrivate(showId: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT COALESCE("isPrivate", false) AS "isPrivate" FROM "Show" WHERE id = ${showId} LIMIT 1
        `.catch(() => [{ isPrivate: false }]);
        if (Boolean(rows[0]?.isPrivate)) return true;
        const req = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "PrivateRequest" WHERE "showId" = ${showId} LIMIT 1
        `.catch(() => []);
        return Boolean(req[0]);
    }

    private async privateBuyer(showId: string): Promise<Recipient[]> {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT r."userId", u.email, u.locale, u.timezone
            FROM "PrivateRequest" r
            JOIN "User" u ON u.id = r."userId"
            WHERE r."showId" = ${showId} AND r.status IN ('paid', 'awarded')
            LIMIT 8
        `.catch(() => []);
        if (!rows.length) {
            const tickets = await this.prisma.$queryRaw<
                { userId: string; email: string; locale?: string | null; timezone?: string | null }[]
            >`
                SELECT t."userId", u.email, u.locale, u.timezone
                FROM "Ticket" t
                JOIN "User" u ON u.id = t."userId"
                WHERE t."showId" = ${showId} AND t.status IN ('paid', 'active')
                LIMIT 8
            `.catch(() => []);
            const out: Recipient[] = [];
            for (const t of tickets) {
                if (!t.userId || !t.email) continue;
                out.push({
                    userId: t.userId,
                    email: t.email,
                    locale: t.locale || "hu",
                    timezone: t.timezone,
                    prefs: await this.follows.getPrefs(t.userId),
                });
            }
            return out;
        }
        const out: Recipient[] = [];
        for (const r of rows) {
            out.push({
                userId: r.userId,
                email: r.email,
                locale: r.locale || "hu",
                timezone: r.timezone,
                prefs: await this.follows.getPrefs(r.userId),
            });
        }
        return out;
    }

    private async followersOf(streamerId: string): Promise<Recipient[]> {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT f."userId", u.email, u.locale, u.timezone
            FROM "StreamerFollow" f
            JOIN "User" u ON u.id = f."userId"
            WHERE f."streamerId" = ${streamerId} AND COALESCE(u.status, 'active') = 'active'
        `;
        const out: Recipient[] = [];
        for (const r of rows) {
            out.push({
                userId: r.userId,
                email: r.email,
                locale: r.locale || "hu",
                timezone: r.timezone,
                prefs: await this.follows.getPrefs(r.userId),
            });
        }
        return out;
    }
}

function liveOrShowHref(kind: FollowNotifyKind, showId: string) {
    if (
        kind === FOLLOW_NOTIFY.goingLive ||
        kind === FOLLOW_NOTIFY.reminder1h ||
        kind === FOLLOW_NOTIFY.reminder30m
    ) {
        return `/live/${showId}`;
    }
    return `/shows/${showId}`;
}

function formatWhen(start: Date | null | undefined, timezoneOrLocale?: string | null) {
    if (!start) return "";
    const tz =
        timezoneOrLocale && timezoneOrLocale.includes("/")
            ? timezoneOrLocale
            : timezoneOrLocale === "hu"
              ? "Europe/Budapest"
              : "UTC";
    return `${formatInTimeZone(start, tz)} (${tz})`;
}

function messageFor(
    kind: FollowNotifyKind,
    streamerName: string,
    title: string,
    when: string,
    isPrivate: boolean,
) {
    if (isPrivate) {
        if (kind === FOLLOW_NOTIFY.newShow) {
            return {
                title: "A megrendelt privát műsorod időpontja megvan",
                body: when ? `${title}\n${when}` : title,
            };
        }
        if (kind === FOLLOW_NOTIFY.reminder24h) {
            return {
                title: "A megrendelt privát műsorod 24 órán belül kezdődik.",
                body: when ? `${title}\n${when}` : title,
            };
        }
        if (kind === FOLLOW_NOTIFY.reminder1h) {
            return {
                title: "A megrendelt privát műsorod 1 órán belül kezdődik.",
                body: title,
            };
        }
        if (kind === FOLLOW_NOTIFY.reminder2h) {
            return {
                title: "A megrendelt privát műsorod 2 órán belül kezdődik.",
                body: when ? `${title}\n${when}` : title,
            };
        }
        if (kind === FOLLOW_NOTIFY.reminder30m) {
            return {
                title: "A megrendelt privát műsorod 30 percen belül kezdődik.",
                body: title,
            };
        }
        return { title: `Most indul:\n${title}`, body: "A privát adás élőben van." };
    }
    if (kind === FOLLOW_NOTIFY.newShow) {
        return {
            title: `${streamerName} új élő eseményt hirdetett`,
            body: when ? `${title}\n${when}` : title,
        };
    }
    if (kind === FOLLOW_NOTIFY.reminder24h) {
        return {
            title: "A követett streamed 24 órán belül kezdődik.",
            body: when ? `${title}\n${when}` : title,
        };
    }
    if (kind === FOLLOW_NOTIFY.reminder1h) {
        return {
            title: "A követett streamed 1 órán belül kezdődik.",
            body: title,
        };
    }
    if (kind === FOLLOW_NOTIFY.reminder2h) {
        return {
            title: "A stream 2 óra múlva indul",
            body: when ? `${title}\n${when}` : title,
        };
    }
    if (kind === FOLLOW_NOTIFY.reminder30m) {
        return {
            title: "A stream 30 perc múlva indul",
            body: title,
        };
    }
    return { title: `Most indul:\n${title}`, body: streamerName };
}
