import { Module } from "@nestjs/common";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BackupController } from "./backup.controller";
import { BackupService } from "./backup.service";

@Module({
    imports: [PrismaModule, AdminGuardModule],
    controllers: [BackupController],
    providers: [BackupService],
    exports: [BackupService],
})
export class BackupModule {}
