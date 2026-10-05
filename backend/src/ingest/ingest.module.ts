import { Module } from "@nestjs/common";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";
import { RtmpIngestService } from "./rtmp-ingest.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { StatsModule } from "../stats/stats.module";

@Module({
    imports: [PrismaModule, AdminGuardModule, StatsModule],
    controllers: [IngestController],
    providers: [IngestService, RtmpIngestService],
    exports: [IngestService],
})
export class IngestModule {}
