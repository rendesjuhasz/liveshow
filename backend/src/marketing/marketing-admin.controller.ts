import { Body, Controller, Get, Param, Patch, Put, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import * as fs from "fs";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { MarketingAutoService } from "./marketing-auto.service";
import { CLIP_LENGTHS } from "./clip-score";

@Controller("admin/marketing")
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
export class MarketingAdminController {
    constructor(private readonly auto: MarketingAutoService) {}

    @Get()
    overview() {
        return this.auto.overview();
    }

    @Get("settings")
    settings() {
        return this.auto.getSettings();
    }

    @Put("settings")
    save(@Body() body: Record<string, unknown>) {
        return this.auto.putSettings(body || {});
    }

    @Patch("jobs/:id")
    job(@Param("id") id: string, @Body() body: { status?: "pending" | "needs_approval" | "skipped" }) {
        const status = body?.status || "pending";
        return this.auto.setJobStatus(id, status);
    }

    @Get("clips/:id/file")
    async clipFile(@Param("id") id: string, @Res() res: Response) {
        const filePath = await this.auto.clipFilePath(id);
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).send("A klip nem található.");
        }
        res.setHeader("Content-Type", "video/mp4");
        return res.sendFile(filePath);
    }

    @Get("meta")
    meta() {
        return {
            clipLengths: CLIP_LENGTHS,
            liveAds: false,
            note: "Élő adásban nincs reklám overlay, banner vagy felugró marketing.",
        };
    }
}
