import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { existsSync } from "fs";
import { join } from "path";
import { verifyMediaSignature } from "./media-sign";
import { resolveInside } from "../security/path-jail";

const MIME: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
};

@Controller("media")
export class MediaController {
    @Get(":kind/:file")
    file(
        @Param("kind") kind: string,
        @Param("file") file: string,
        @Query("e") exp: string,
        @Query("s") sig: string,
        @Res() res: Response,
    ) {
        if (!verifyMediaSignature(kind, file, exp, sig)) {
            return res.status(403).send("Érvénytelen vagy lejárt média token.");
        }
        const root = join(process.cwd(), "uploads", kind);
        let resolved: string;
        try {
            resolved = resolveInside(root, join(root, file));
        } catch {
            return res.status(403).send("Érvénytelen fájlútvonal.");
        }
        if (!existsSync(resolved)) {
            return res.status(404).send("A fájl nem található.");
        }
        const ext = file.includes(".") ? file.slice(file.lastIndexOf(".")).toLowerCase() : "";
        const type = MIME[ext];
        if (!type) {
            return res.status(403).send("Nem engedélyezett fájltípus.");
        }
        res.setHeader("Content-Type", type);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Disposition", "inline");
        res.setHeader("Cache-Control", "private, max-age=300");
        res.setHeader("Referrer-Policy", "same-origin");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; sandbox");
        return res.sendFile(resolved);
    }
}
