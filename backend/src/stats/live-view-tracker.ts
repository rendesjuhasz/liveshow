import { Injectable } from "@nestjs/common";

export type LiveSession = {
    streamId: string;
    showId?: string | null;
    userId?: string | null;
    firstAt: number;
    lastAt: number;
};

export type FlushedLiveSession = LiveSession & { seconds: number };

const LIVE_TTL_MS = 90_000;

@Injectable()
export class LiveViewTracker {
    private sessions = new Map<string, LiveSession>();

    heartbeat(input: { streamId?: string | null; showId?: string | null; userId?: string | null }): FlushedLiveSession[] {
        const streamId = String(input.streamId || "").trim();
        const showId = String(input.showId || "").trim() || null;
        if (!streamId && !showId) return [];
        const userId = String(input.userId || "").trim() || null;
        const key = `${showId || streamId}:${userId || streamId}`;
        const now = Date.now();
        const existing = this.sessions.get(key);
        if (existing) {
            existing.lastAt = now;
        } else {
            this.sessions.set(key, {
                streamId: streamId || showId || "",
                showId,
                userId,
                firstAt: now,
                lastAt: now,
            });
        }
        return this.takeExpired(now);
    }

    takeExpired(now = Date.now()): FlushedLiveSession[] {
        const cutoff = now - LIVE_TTL_MS;
        const flushed: FlushedLiveSession[] = [];
        for (const [key, session] of this.sessions) {
            if (session.lastAt < cutoff) {
                this.sessions.delete(key);
                flushed.push(this.withSeconds(session));
            }
        }
        return flushed;
    }

    prune() {
        this.takeExpired();
    }

    total() {
        return this.activeSessions().length;
    }

    byShow() {
        const map = new Map<string, number>();
        for (const session of this.activeSessions()) {
            const id = session.showId || session.streamId;
            if (!id) continue;
            map.set(id, (map.get(id) || 0) + 1);
        }
        return map;
    }

    private activeSessions() {
        const cutoff = Date.now() - LIVE_TTL_MS;
        return [...this.sessions.values()].filter((session) => session.lastAt >= cutoff);
    }

    clearStream(streamId: string, showId?: string | null): FlushedLiveSession[] {
        const sid = String(streamId || "").trim();
        const gid = String(showId || "").trim();
        const flushed: FlushedLiveSession[] = [];
        for (const [key, session] of this.sessions) {
            if ((sid && session.streamId === sid) || (gid && session.showId === gid)) {
                this.sessions.delete(key);
                flushed.push(this.withSeconds(session));
            }
        }
        return flushed;
    }

    private withSeconds(session: LiveSession): FlushedLiveSession {
        const seconds = Math.max(0, (session.lastAt - session.firstAt) / 1000);
        return { ...session, seconds };
    }
}
