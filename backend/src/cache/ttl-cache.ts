export class TtlCache {
    private readonly store = new Map<string, { exp: number; value: unknown }>();
    private readonly inflight = new Map<string, Promise<unknown>>();
    private hits = 0;
    private misses = 0;
    private coalesced = 0;

    hasFresh(key: string) {
        const hit = this.store.get(key);
        return Boolean(hit && hit.exp > Date.now());
    }

    stats() {
        const total = this.hits + this.misses;
        return {
            hits: this.hits,
            misses: this.misses,
            coalesced: this.coalesced,
            hitRate: total ? Math.round((this.hits / total) * 1000) / 10 : 0,
        };
    }

    async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
        const hit = this.store.get(key);
        if (hit && hit.exp > Date.now()) {
            this.hits += 1;
            return hit.value as T;
        }
        const pending = this.inflight.get(key);
        if (pending) {
            this.coalesced += 1;
            return pending as Promise<T>;
        }
        this.misses += 1;
        const run = factory()
            .then((value) => {
                this.store.set(key, { exp: Date.now() + Math.max(1_000, ttlMs), value });
                this.inflight.delete(key);
                return value;
            })
            .catch((err) => {
                this.inflight.delete(key);
                throw err;
            });
        this.inflight.set(key, run);
        return run;
    }

    deletePrefix(prefix: string) {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) this.store.delete(key);
        }
        for (const key of this.inflight.keys()) {
            if (key.startsWith(prefix)) this.inflight.delete(key);
        }
    }
}
