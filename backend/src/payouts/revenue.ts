import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { splitRevenue } from "./commission";
import { getPayoutSettings } from "./platform-config";
import { emptyGroupStats } from "../tickets/ticket-groups";
import { payoutDueState } from "./payout-cycle";
import { privateShowIds } from "../private-streams/private-schema";
import { readShowStatuses } from "../shows/show-status-db";

async function privateDeliveredShowIds(prisma: PrismaService, showIds: string[]) {
    const allPrivate = await privateShowIds(prisma);
    const privateIds = new Set(showIds.filter((id) => allPrivate.has(id)));
    const delivered = new Set<string>();
    if (!privateIds.size) return { privateIds, delivered };

    const ids = [...privateIds];
    const statuses = await readShowStatuses(prisma, ids);
    for (const id of ids) {
        if (statuses.get(id) === "archived") delivered.add(id);
    }

    const liveRows = await prisma.show.findMany({
        where: { id: { in: ids } },
        select: { id: true, live: true },
    });
    const liveNow = new Set(liveRows.filter((row) => row.live).map((row) => row.id));

    const streams = await prisma.stream.findMany({
        where: { showId: { in: ids } },
        select: { showId: true, isLive: true },
    });
    for (const row of streams) {
        if (row.showId && !row.isLive && !liveNow.has(row.showId)) delivered.add(row.showId);
    }

    const backups = await prisma.$queryRaw<{ showId: string }[]>`
        SELECT DISTINCT "showId" FROM "PrivateBackup"
        WHERE "showId" IN (${Prisma.join(ids)})
    `.catch(() => []);
    for (const row of backups) {
        if (row.showId && !liveNow.has(row.showId)) delivered.add(row.showId);
    }

    return { privateIds, delivered };
}

export async function computeStreamerRevenue(prisma: PrismaService, streamerId: string) {
    const settings = await getPayoutSettings(prisma);
    const shows = await prisma.show.findMany({
        where: { streamerId },
        orderBy: { startTime: "desc" },
        select: { id: true, title: true, startTime: true, price: true, live: true },
    });
    const showIds = shows.map((s) => s.id);
    const { privateIds, delivered: privateDelivered } = await privateDeliveredShowIds(prisma, showIds);
    const overrideMap = new Map<string, number>();
    if (showIds.length) {
        const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, "commissionPercent" FROM "Show" WHERE id IN (${showIds.map((_, i) => `$${i + 1}`).join(",")})`,
            ...showIds,
        ).catch(() => []);
        for (const row of rows) {
            if (row.commissionPercent != null && Number.isFinite(Number(row.commissionPercent))) {
                overrideMap.set(row.id, Math.min(90, Math.max(0, Math.round(Number(row.commissionPercent)))));
            }
        }
    }

    const tickets = showIds.length
        ? await prisma.ticket.findMany({
              where: { showId: { in: showIds }, status: { in: ["paid", "active"] } },
              select: { showId: true, price: true },
          })
        : [];

    const byShow = new Map<string, { tickets: number; gross: number }>();
    const heldByShow = new Map<string, { tickets: number; gross: number }>();
    const creditedTickets: typeof tickets = [];
    for (const t of tickets) {
        if (privateIds.has(t.showId) && !privateDelivered.has(t.showId)) {
            const cur = heldByShow.get(t.showId) || { tickets: 0, gross: 0 };
            cur.tickets += 1;
            cur.gross += t.price;
            heldByShow.set(t.showId, cur);
            continue;
        }
        creditedTickets.push(t);
        const cur = byShow.get(t.showId) || { tickets: 0, gross: 0 };
        cur.tickets += 1;
        cur.gross += t.price;
        byShow.set(t.showId, cur);
    }

    let groups = emptyGroupStats();
    let spendGross = 0;
    let spendTickets = 0;
    try {
        const spendRows = await prisma.$queryRaw<any[]>`
            SELECT "ticketGroup" AS name,
                   SUM("ticketsSpent")::int AS tickets,
                   SUM("calculatedAmount")::int AS amount
            FROM "TicketSpend"
            WHERE "streamerId" = ${streamerId}
            GROUP BY "ticketGroup"
        `;
        const byName = new Map(spendRows.map((r) => [String(r.name), r]));
        groups = groups.map((g) => {
            const hit = byName.get(g.name);
            return {
                ...g,
                ticketsSpent: hit?.tickets || 0,
                creditedAmount: hit?.amount || 0,
            };
        });
        spendGross = groups.reduce((s, g) => s + g.creditedAmount, 0);
        spendTickets = groups.reduce((s, g) => s + g.ticketsSpent, 0);

        const spendByShow = await prisma.$queryRaw<any[]>`
            SELECT COALESCE("showId", '') AS "showId",
                   SUM("ticketsSpent")::int AS tickets,
                   SUM("calculatedAmount")::int AS amount
            FROM "TicketSpend"
            WHERE "streamerId" = ${streamerId}
            GROUP BY "showId"
        `;
        for (const row of spendByShow) {
            const showId = String(row.showId || "");
            if (!showId) continue;
            const cur = byShow.get(showId) || { tickets: 0, gross: 0 };
            cur.tickets += Number(row.tickets) || 0;
            cur.gross += Number(row.amount) || 0;
            byShow.set(showId, cur);
        }
    } catch {
        /* tábla a migráció előtt hiányozhat */
    }

    const showRows = shows.map((s) => {
        const row = byShow.get(s.id) || { tickets: 0, gross: 0 };
        const held = heldByShow.get(s.id) || { tickets: 0, gross: 0 };
        const platformPercent = overrideMap.get(s.id) ?? settings.commissionPercent;
        const part = splitRevenue(row.gross, platformPercent);
        const heldPart = splitRevenue(held.gross, platformPercent);
        const isPrivate = privateIds.has(s.id);
        const privatePending = isPrivate && held.tickets > 0;
        return {
            ...s,
            tickets: row.tickets,
            heldTickets: held.tickets,
            heldGross: heldPart.gross,
            heldNet: heldPart.net,
            isPrivate,
            privatePending,
            gross: part.gross,
            commission: part.commission,
            net: part.net,
            revenue: part.net,
            platformPercent: part.commissionPercent,
            streamerPercent: 100 - part.commissionPercent,
        };
    });

    const gross = showRows.reduce((sum, s) => sum + s.gross, 0);
    const commission = showRows.reduce((sum, s) => sum + s.commission, 0);
    const net = showRows.reduce((sum, s) => sum + s.net, 0);
    const ticketsSold = showRows.reduce((sum, s) => sum + s.tickets, 0);
    const privateHeldGross = showRows.reduce((sum, s) => sum + s.heldGross, 0);
    const privateHeldNet = showRows.reduce((sum, s) => sum + s.heldNet, 0);
    const privateHeldTickets = showRows.reduce((sum, s) => sum + s.heldTickets, 0);

    const payouts = await prisma.payout.findMany({
        where: { streamerId },
    });
    const pending = payouts.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
    const approved = payouts.filter((p) => p.status === "approved").reduce((sum, p) => sum + p.amount, 0);
    const paid = payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
    const reserved = pending + approved + paid;
    const available = Math.max(0, net - reserved);
    const cycle = payoutDueState({ cycle: settings.payoutCycle, available });

    let archiveViews = 0;
    if (showIds.length) {
        const views = await prisma.$queryRawUnsafe<any[]>(
            `SELECT COUNT(*)::int AS views FROM "ArchiveView"
             WHERE "showId" IN (${showIds.map((_, i) => `$${i + 1}`).join(",")})`,
            ...showIds,
        ).catch(() => [{ views: 0 }]);
        archiveViews = Number(views[0]?.views) || 0;
    }

    const ratings = await prisma.$queryRaw<any[]>`
        SELECT ROUND(AVG(r.rating)::numeric, 1) AS average, COUNT(*)::int AS count
        FROM "Review" r
        JOIN "Show" s ON s.id = r."showId"
        WHERE s."streamerId" = ${streamerId}
          AND COALESCE(r.status, 'approved') = 'approved'
    `.catch(() => [{ average: 0, count: 0 }]);

    return {
        commissionPercent: settings.commissionPercent,
        streamerPercent: settings.streamerPercent,
        payoutCycle: settings.payoutCycle,
        payoutDue: cycle,
        gross,
        commission,
        net,
        ticketsSpent: spendTickets,
        ticketsSold,
        ticketGroups: groups,
        spendGross,
        showTicketGross: creditedTickets.reduce((sum, t) => sum + t.price, 0),
        privateHeldGross,
        privateHeldNet,
        privateHeldTickets,
        pendingPayouts: pending,
        approvedPayouts: approved,
        paidOut: paid,
        reserved,
        available,
        archiveViews,
        reviewAverage: Number(ratings[0]?.average) || 0,
        reviewCount: Number(ratings[0]?.count) || 0,
        shows: showRows,
    };
}
