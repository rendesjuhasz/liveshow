import { Injectable } from "@nestjs/common";
import type { LiveVideoBackend } from "./livekit-config";
import { lockLiveVideoBackend, plannedLiveVideoBackend } from "./livekit-config";

@Injectable()
export class LiveVideoSessionService {
    private readonly backends = new Map<string, LiveVideoBackend>();

    get(showId: string): LiveVideoBackend | null {
        const id = String(showId || "").trim();
        if (!id) return null;
        return this.backends.get(id) || null;
    }

    /** First announced backend wins, but only if it matches the show's planned path. */
    set(showId: string, backend: LiveVideoBackend) {
        const id = String(showId || "").trim();
        if (!id) return false;
        const planned = plannedLiveVideoBackend(id);
        if (backend !== planned) return false;
        const current = this.backends.get(id) || null;
        if (current && current !== planned) {
            this.backends.set(id, planned);
            return true;
        }
        const locked = lockLiveVideoBackend(current, backend);
        if (locked !== planned) return false;
        this.backends.set(id, locked);
        return true;
    }

    clear(showId: string) {
        const id = String(showId || "").trim();
        if (id) this.backends.delete(id);
    }
}
