import { Injectable } from "@nestjs/common";

export type LiveSession = {
    streamId: string;
    showId?: string | null;
    userId?: string | null;
    at: number;
};

const LIVE_TTL_MS = 90_000;

@Injectable()
export class LiveViewTracker {
    private sessions = new Map<string, LiveSession>();

    heartbeat(input: { streamId?: string | null; showId?: string | null; userId?: string | null }) {
        const streamId = String(input.streamId || "").trim();
        const showId = String(input.showId || "").trim() || null;
        if (!streamId && !showId) return;
        const userId = String(input.userId || "").trim() || null;
        const key = `${showId || streamId}:${userId || streamId}`;
        this.sessions.set(key, {
            streamId: streamId || showId || "",
            showId,
            userId,
            at: Date.now(),
        });
        this.prune();
    }

    prune() {
        const cutoff = Date.now() - LIVE_TTL_MS;
        for (const [key, session] of this.sessions) {
            if (session.at < cutoff) this.sessions.delete(key);
        }
    }

    total() {
        this.prune();
        return this.sessions.size;
    }

    byShow() {
        this.prune();
        const map = new Map<string, number>();
        for (const session of this.sessions.values()) {
            const id = session.showId || session.streamId;
            if (!id) continue;
            map.set(id, (map.get(id) || 0) + 1);
        }
        return map;
    }

    clearStream(streamId: string, showId?: string | null) {
        const sid = String(streamId || "").trim();
        const gid = String(showId || "").trim();
        for (const [key, session] of this.sessions) {
            if (
                (sid && session.streamId === sid) ||
                (gid && session.showId === gid)
            ) {
                this.sessions.delete(key);
            }
        }
    }
}
