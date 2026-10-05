import { Injectable } from "@nestjs/common";

type PreviewFrame = { mime: string; buf: Buffer; at: number };

@Injectable()
export class LivePreviewService {
    private readonly frames = new Map<string, PreviewFrame>();
    private static readonly TTL_MS = 20_000;

    put(showId: string, mime: string, data: string | Buffer) {
        const id = showId.trim();
        if (!id) return;
        const buf = Buffer.isBuffer(data)
            ? data
            : Buffer.from(String(data).replace(/\s/g, ""), "base64");
        if (!buf.length || buf.length > 400_000) return;
        this.frames.set(id, {
            mime: mime.includes("jpeg") || mime.includes("jpg") ? "image/jpeg" : "image/jpeg",
            buf,
            at: Date.now(),
        });
    }

    get(showId: string): PreviewFrame | null {
        const row = this.frames.get(showId.trim());
        if (!row) return null;
        if (Date.now() - row.at > LivePreviewService.TTL_MS) {
            this.frames.delete(showId.trim());
            return null;
        }
        return row;
    }
}
