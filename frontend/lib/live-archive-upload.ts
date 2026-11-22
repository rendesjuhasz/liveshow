import { apiUpload } from "@/api/http";

function sleep(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function uploadWithRetry(path: string, form: FormData, tries = 5) {
    let last: unknown;
    for (let i = 0; i < tries; i++) {
        try {
            return await apiUpload(path, form);
        } catch (err) {
            last = err;
            await sleep(1000 * Math.pow(2, i));
        }
    }
    throw last instanceof Error ? last : new Error("A felvétel feltöltése nem sikerült.");
}

export function createLiveArchiveUploader(showId: string) {
    const queue: Blob[] = [];
    let nextIndex = 0;
    let pumping = false;
    let mime = "video/webm";

    async function pump() {
        if (pumping) return;
        pumping = true;
        try {
            while (queue.length) {
                const blob = queue[0];
                const form = new FormData();
                const ext = mime.includes("mp4") ? "mp4" : "webm";
                form.append("index", String(nextIndex));
                form.append("video", new File([blob], `chunk-${nextIndex}.${ext}`, { type: mime }));
                await uploadWithRetry(`/streamer/shows/${showId}/live-archive-chunk`, form);
                queue.shift();
                nextIndex += 1;
            }
        } finally {
            pumping = false;
        }
    }

    return {
        pending() {
            return queue.length;
        },
        enqueue(blob: Blob) {
            if (!blob || blob.size < 1) return;
            if (blob.type) mime = blob.type.split(";")[0].trim() || mime;
            queue.push(blob);
            void pump().catch(() => undefined);
        },
        async finalize() {
            let lastErr: unknown;
            for (let i = 0; i < 6; i++) {
                try {
                    await pump();
                    lastErr = undefined;
                    break;
                } catch (err) {
                    lastErr = err;
                    await sleep(1000 * (i + 1));
                }
            }
            const leftover = queue.splice(0);
            const form = new FormData();
            form.append("done", "1");
            if (leftover.length) {
                const blob = new Blob(leftover, { type: mime });
                const ext = mime.includes("mp4") ? "mp4" : "webm";
                form.append("video", new File([blob], `tail.${ext}`, { type: mime }));
            }
            try {
                if (leftover.length || nextIndex > 0) {
                    await uploadWithRetry(`/streamer/shows/${showId}/live-archive-finalize`, form);
                    return;
                }
                throw lastErr instanceof Error
                    ? lastErr
                    : new Error("Nem volt rögzített kép. A visszanézés üres maradt.");
            } catch (err) {
                if (leftover.length) queue.unshift(...leftover);
                throw err instanceof Error ? err : new Error("A felvétel feltöltése nem sikerült.");
            }
        },
    };
}

export type LiveArchiveUploader = ReturnType<typeof createLiveArchiveUploader>;
