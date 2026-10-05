import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { OpsModule } from "../ops/ops.module";
import { MaintenanceService } from "./maintenance.service";
import { MaintenanceScheduler } from "./maintenance.scheduler";
import { MaintenanceAdminController } from "./maintenance-admin.controller";
import { MaintenancePublicController } from "./maintenance.controller";
import { MaintenanceMiddleware } from "./maintenance.middleware";

@Module({
    imports: [PrismaModule, AdminGuardModule, OpsModule],
    controllers: [MaintenancePublicController, MaintenanceAdminController],
    providers: [MaintenanceService, MaintenanceScheduler, MaintenanceMiddleware],
    exports: [MaintenanceService],
})
export class MaintenanceModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(MaintenanceMiddleware).forRoutes("*");
    }
}
