import { Module } from "@nestjs/common";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BackupModule } from "../backup/backup.module";
import { CostController } from "./cost.controller";
import { CostService } from "./cost.service";

@Module({
    imports: [PrismaModule, AdminGuardModule, BackupModule],
    controllers: [CostController],
    providers: [CostService],
    exports: [CostService],
})
export class CostModule {}
