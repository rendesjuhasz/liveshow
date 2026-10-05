import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { StreamerApprovedGuard } from "../streamers/streamer-approved.guard";
import { PreflightService } from "./preflight.service";
import { PreflightSaveDto } from "../dto/bodies";
import { assertRateLimit, clientKey } from "../security/rate-limit";

type Authed = { streamer: { id: string } };

@Controller("streamer/preflight")
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, StreamerApprovedGuard)
export class PreflightController {
    constructor(private readonly preflight: PreflightService) {}

    @Get()
    last(@Req() req: Authed) {
        return this.preflight.last(req.streamer.id);
    }

    @Get("echo")
    echo() {
        return this.preflight.echo();
    }

    @Get("ingest")
    ingest() {
        return this.preflight.ingestStatus();
    }

    @Post("upload")
    @UseInterceptors(
        FileInterceptor("chunk", {
            storage: memoryStorage(),
            limits: { fileSize: 2 * 1024 * 1024 },
        }),
    )
    async upload(
        @Req() req: Authed & { headers?: Record<string, string> },
        @UploadedFile() file?: { size?: number; buffer?: Buffer },
    ) {
        await assertRateLimit(`preflight-up:${req.streamer.id}`, 20, 60_000);
        await assertRateLimit(`preflight-up-ip:${clientKey(req)}`, 30, 60_000);
        const started = Number((req as { body?: { startedAt?: string } }).body?.startedAt);
        const bytes = file?.buffer?.length || file?.size || 0;
        return this.preflight.receiveUpload(bytes, Number.isFinite(started) && started > 0 ? started : Date.now() - 200);
    }

    @Post("probe")
    @UseInterceptors(
        FileInterceptor("clip", {
            storage: memoryStorage(),
            limits: { fileSize: 8 * 1024 * 1024 },
        }),
    )
    async probe(
        @Req() req: Authed,
        @UploadedFile() file?: { buffer?: Buffer; size?: number; mimetype?: string },
    ) {
        await assertRateLimit(`preflight-probe:${req.streamer.id}`, 8, 60_000);
        return this.preflight.inspectProbe(file);
    }

    @Post()
    async save(@Req() req: Authed, @Body() body: PreflightSaveDto) {
        await assertRateLimit(`preflight-save:${req.streamer.id}`, 12, 60_000);
        return this.preflight.save(req.streamer.id, body);
    }
}
