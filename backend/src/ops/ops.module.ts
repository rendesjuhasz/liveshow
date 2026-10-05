import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { IngestModule } from "../ingest/ingest.module";
import { BackupModule } from "../backup/backup.module";
import { OpsService } from "./ops.service";
import { HealthController } from "./health.controller";
import { OpsAdminController } from "./ops-admin.controller";

@Module({
    imports: [PrismaModule, AdminGuardModule, IngestModule, BackupModule],
    controllers: [HealthController, OpsAdminController],
    providers: [OpsService],
    exports: [OpsService],
})
export class OpsModule {}
