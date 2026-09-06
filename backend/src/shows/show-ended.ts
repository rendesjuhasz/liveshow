import { PrismaService } from "../prisma/prisma.service";
import { normalizeShowStatus } from "./show-status";

type ShowLike = {
    id: string;
    live?: boolean | null;
    startTime?: Date | string | null;
    status?: string | null;
};

export function isEndedByFields(show: ShowLike, now = Date.now()) {
    if (show.live) return false;
    if (normalizeShowStatus(show.status) === "archived") return true;
    if (show.startTime && new Date(show.startTime).getTime() <= now) return true;
    return false;
}

export async function endedShowIdSet(prisma: PrismaService, shows: ShowLike[]) {
    const ended = new Set<string>();
    const checkArchive: string[] = [];
    for (const show of shows) {
        if (show.live) continue;
        if (isEndedByFields(show)) {
            ended.add(show.id);
            continue;
        }
        checkArchive.push(show.id);
    }
    if (!checkArchive.length) return ended;
    const archives = await prisma.archive.findMany({
        where: { showId: { in: checkArchive } },
        select: { showId: true },
    }).catch(() => []);
    for (const row of archives) {
        if (row.showId) ended.add(row.showId);
    }
    return ended;
}
