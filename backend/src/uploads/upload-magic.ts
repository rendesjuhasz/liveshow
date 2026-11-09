import { BadRequestException } from "@nestjs/common";
import { existsSync, readFileSync, unlinkSync } from "fs";

export type MediaKind = "image" | "video";

type Sniffed = "jpeg" | "png" | "gif" | "webp" | "mp4" | "webm" | "mov" | null;

function sniff(buf: Buffer): Sniffed {
    if (buf.length < 12) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
    if (
        buf.slice(0, 4).toString("ascii") === "RIFF" &&
        buf.slice(8, 12).toString("ascii") === "WEBP"
    ) {
        return "webp";
    }
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
    const ftyp = buf.slice(4, 8).toString("ascii");
    if (ftyp === "ftyp") {
        const brand = buf.slice(8, 12).toString("ascii");
        if (brand.startsWith("qt")) return "mov";
        return "mp4";
    }
    return null;
}

const IMAGE_MIME: Record<string, Sniffed[]> = {
    "image/jpeg": ["jpeg"],
    "image/png": ["png"],
    "image/gif": ["gif"],
    "image/webp": ["webp"],
};

const VIDEO_MIME: Record<string, Sniffed[]> = {
    "video/mp4": ["mp4"],
    "video/x-m4v": ["mp4"],
    "video/webm": ["webm"],
    "video/quicktime": ["mov", "mp4"],
    "video/x-quicktime": ["mov", "mp4"],
};

function unlinkQuiet(filePath: string) {
    try {
        if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
        /* ignore */
    }
}

export function assertUploadedMedia(filePath: string, mime: string, kind: MediaKind) {
    if (!filePath || !existsSync(filePath)) {
        throw new BadRequestException("A feltöltött fájl nem található.");
    }
    const type = String(mime || "").toLowerCase().split(";")[0].trim();
    if (!type) {
        unlinkQuiet(filePath);
        throw new BadRequestException("Ismeretlen vagy tiltott MIME típus.");
    }
    const sniffedEarly = sniff(readFileSync(filePath).subarray(0, 64));
    if (type === "application/octet-stream" && kind === "video") {
        if (sniffedEarly === "mp4" || sniffedEarly === "webm" || sniffedEarly === "mov") {
            return;
        }
        unlinkQuiet(filePath);
        throw new BadRequestException("A videó MP4, MOV vagy WEBM legyen.");
    }
    const allowed = kind === "image" ? IMAGE_MIME[type] : VIDEO_MIME[type];
    if (!allowed) {
        unlinkQuiet(filePath);
        throw new BadRequestException(
            kind === "image"
                ? "A kép JPEG, PNG, WebP vagy GIF legyen."
                : "A videó MP4, MOV vagy WEBM legyen.",
        );
    }
    const detected = sniffedEarly;
    if (!detected || !allowed.includes(detected)) {
        unlinkQuiet(filePath);
        throw new BadRequestException("A fájl tartalma nem egyezik a MIME típussal.");
    }
}
