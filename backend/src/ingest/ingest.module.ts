import { Module } from "@nestjs/common";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminGuardModule } from "../admin/admin-guard.module";

@Module({
    imports: [PrismaModule, AdminGuardModule],
    controllers: [IngestController],
    providers: [IngestService],
    exports: [IngestService],
})
export class IngestModule {}
