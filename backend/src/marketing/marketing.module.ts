import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthGuardModule } from "../auth/auth-guard.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { StatsModule } from "../stats/stats.module";
import { MarketingController } from "./marketing.controller";
import { MarketingAdminController } from "./marketing-admin.controller";
import { MarketingService } from "./marketing.service";
import { MarketingScheduler } from "./marketing.scheduler";
import { MarketingAutoService } from "./marketing-auto.service";

@Module({
    imports: [PrismaModule, AuthGuardModule, AdminGuardModule, StatsModule],
    controllers: [MarketingController, MarketingAdminController],
    providers: [MarketingService, MarketingScheduler, MarketingAutoService],
    exports: [MarketingAutoService],
})
export class MarketingModule {}
