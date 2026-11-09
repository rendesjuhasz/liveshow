import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { randomUUID } from "crypto";
import { BadRequestException } from "@nestjs/common";
import { diskStorage } from "multer";

const DIR = join(process.cwd(), "uploads", "contact");

export function contactShotMulterOptions() {
    if (!existsSync(DIR)) {
        mkdirSync(DIR, { recursive: true });
    }
    return {
        storage: diskStorage({
            destination: DIR,
            filename: (
                _req: unknown,
                file: { originalname: string },
                cb: (error: Error | null, filename: string) => void,
            ) => {
                const ext = extname(file.originalname || "").toLowerCase() || ".jpg";
                cb(null, `${randomUUID()}${ext}`);
            },
        }),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (
            _req: unknown,
            file: { mimetype: string },
            cb: (error: Error | null, accept: boolean) => void,
        ) => {
            const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
            if (!ok) {
                cb(new BadRequestException("A képernyőkép JPEG, PNG vagy WebP legyen."), false);
                return;
            }
            cb(null, true);
        },
    };
}

export function contactShotStoredPath(filename: string) {
    return `uploads/contact/${filename}`;
}
