import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { randomUUID } from "crypto";
import { BadRequestException } from "@nestjs/common";
import { diskStorage } from "multer";

const AVATAR_DIR = join(process.cwd(), "uploads", "avatars");

export function avatarMulterOptions() {
    if (!existsSync(AVATAR_DIR)) {
        mkdirSync(AVATAR_DIR, { recursive: true });
    }
    return {
        storage: diskStorage({
            destination: AVATAR_DIR,
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
            const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
                file.mimetype,
            );
            if (!ok) {
                cb(new BadRequestException("A profilkép JPEG, PNG, WebP vagy GIF legyen."), false);
                return;
            }
            cb(null, true);
        },
    };
}

export function avatarPublicPath(filename: string) {
    return `/uploads/avatars/${filename}`;
}
