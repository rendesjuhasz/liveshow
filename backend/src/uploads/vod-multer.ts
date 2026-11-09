import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { randomUUID } from "crypto";
import { BadRequestException } from "@nestjs/common";
import { diskStorage } from "multer";

const TMP_DIR = join(process.cwd(), "uploads", "vod-tmp");
export const COVER_DIR = join(process.cwd(), "uploads", "covers");

const VIDEO_EXT = [".mp4", ".mov", ".webm", ".m4v"];
const VIDEO_MIME = [
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-m4v",
    "video/x-quicktime",
];
const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function ensureVodDirs() {
    if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
    if (!existsSync(COVER_DIR)) mkdirSync(COVER_DIR, { recursive: true });
}

export function vodMulterOptions() {
    ensureVodDirs();
    return {
        storage: diskStorage({
            destination: (
                _req: unknown,
                file: { fieldname: string },
                cb: (error: Error | null, dest: string) => void,
            ) => {
                cb(null, file.fieldname === "cover" ? COVER_DIR : TMP_DIR);
            },
            filename: (
                _req: unknown,
                file: { originalname: string },
                cb: (error: Error | null, filename: string) => void,
            ) => {
                const ext = extname(file.originalname || "").toLowerCase() || ".bin";
                cb(null, `${randomUUID()}${ext}`);
            },
        }),
        limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 2 },
        fileFilter: (
            _req: unknown,
            file: { fieldname: string; mimetype: string; originalname: string },
            cb: (error: Error | null, accept: boolean) => void,
        ) => {
            const ext = extname(file.originalname || "").toLowerCase();
            if (file.fieldname === "cover") {
                if (!IMAGE_MIME.includes(file.mimetype)) {
                    cb(new BadRequestException("A borítókép JPEG, PNG, WebP vagy GIF legyen."), false);
                    return;
                }
                cb(null, true);
                return;
            }
            if (file.fieldname === "video") {
                const mimeOk = VIDEO_MIME.includes(file.mimetype);
                const extOk = VIDEO_EXT.includes(ext);
                if (!extOk || !mimeOk) {
                    cb(new BadRequestException("A videó MP4, MOV vagy WEBM legyen."), false);
                    return;
                }
                cb(null, true);
                return;
            }
            cb(new BadRequestException("Ismeretlen feltöltési mező."), false);
        },
    };
}

export function liveArchiveMulterOptions() {
    ensureVodDirs();
    return {
        storage: diskStorage({
            destination: TMP_DIR,
            filename: (
                _req: unknown,
                file: { originalname: string },
                cb: (error: Error | null, filename: string) => void,
            ) => {
                const ext = extname(file.originalname || "").toLowerCase() || ".webm";
                cb(null, `${randomUUID()}${VIDEO_EXT.includes(ext) ? ext : ".webm"}`);
            },
        }),
        limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 },
        fileFilter: (
            _req: unknown,
            file: { mimetype: string; originalname: string },
            cb: (error: Error | null, accept: boolean) => void,
        ) => {
            const ext = extname(file.originalname || "").toLowerCase();
            const mime = String(file.mimetype || "").toLowerCase().split(";")[0].trim();
            const mimeOk = VIDEO_MIME.includes(mime) || mime === "application/octet-stream";
            const extOk = VIDEO_EXT.includes(ext) || !ext;
            if (!mimeOk && !extOk) {
                cb(new BadRequestException("A felvétel MP4 vagy WEBM legyen."), false);
                return;
            }
            cb(null, true);
        },
    };
}

export function coverPublicPath(filename: string) {
    return `/uploads/covers/${filename}`;
}
