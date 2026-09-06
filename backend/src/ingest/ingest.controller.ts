import { BadRequestException, Controller, Post, Body, UseGuards } from "@nestjs/common";
import { IngestService } from "./ingest.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../admin/admin.guard";

@Controller("ingest")
@UseGuards(JwtAuthGuard, AdminGuard)
export class IngestController {
    constructor(private readonly ingestService: IngestService) {}

    @Post("start")
    start(@Body() body: { streamId?: string; rtpPort?: number }) {
        const streamId = body?.streamId?.trim();
        const rtpPort = Number(body?.rtpPort);

        if (!streamId) {
            throw new BadRequestException("A streamId kötelező.");
        }

        if (!Number.isInteger(rtpPort) || rtpPort < 1024 || rtpPort > 65535) {
            throw new BadRequestException("Érvényes rtpPort kell (1024–65535).");
        }

        return this.ingestService.startIngest(streamId, rtpPort);
    }

    @Post("stop")
    stop(@Body() body: { streamId?: string }) {
        const streamId = body?.streamId?.trim();
        if (!streamId) {
            throw new BadRequestException("A streamId kötelező.");
        }
        return this.ingestService.stopIngest(streamId);
    }
}
