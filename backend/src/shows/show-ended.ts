import { isEndedByFields } from "./show-lifecycle";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeShowStatus } from "./show-status";

export { isEndedByFields, showAudiencePhase, shouldPersistMissed, hasEverGoneLive, SHOW_MISS_AFTER_MS } from "./show-lifecycle";

type ShowLike = {
    id: string;
    live?: boolean | null;
    startTime?: Date | string | null;
    endTime?: Date | string | null;
    status?: string | null;
    wentLiveAt?: Date | string | null;
};

export async function endedShowIdSet(prisma: PrismaService, shows: ShowLike[]) {
    const ended = new Set<string>();
    const checkArchive: string[] = [];
    for (const show of shows) {
        if (show.live) continue;
        if (isEndedByFields(show)) {
            ended.add(show.id);
            continue;
        }
        if (normalizeShowStatus(show.status) === "missed") continue;
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
