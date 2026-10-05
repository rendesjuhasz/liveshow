type WakeLockLike = {
    released: boolean;
    release: () => Promise<void>;
    addEventListener: (type: "release", fn: () => void) => void;
};

export function createLiveWakeLock() {
    let sentinel: WakeLockLike | null = null;

    async function acquire() {
        if (typeof navigator === "undefined") return false;
        const api = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> } })
            .wakeLock;
        if (!api?.request) return false;
        try {
            if (sentinel && !sentinel.released) return true;
            sentinel = await api.request("screen");
            sentinel.addEventListener("release", () => {
                sentinel = null;
            });
            return true;
        } catch {
            return false;
        }
    }

    async function release() {
        const current = sentinel;
        sentinel = null;
        if (!current || current.released) return;
        try {
            await current.release();
        } catch {
            /* ignore */
        }
    }

    return { acquire, release };
}
