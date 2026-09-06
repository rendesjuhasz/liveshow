import { Module } from "@nestjs/common";
import { ArchiveService } from "./archive.service";
import { ArchiveController } from "./archive.controller";
import { PublicArchivesController } from "./public-archives.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { I18nModule } from "../i18n/i18n.module";
import { FfmpegPipeline } from "../streaming/ffmpeg-pipeline";
import { AdminGuardModule } from "../admin/admin-guard.module";

import { SecurityModule } from "../security/security.module";

@Module({
    imports: [PrismaModule, AdminGuardModule, I18nModule, SecurityModule],
    controllers: [ArchiveController, PublicArchivesController],
    providers: [ArchiveService, FfmpegPipeline],
    exports: [ArchiveService],
})
export class ArchiveModule {}
