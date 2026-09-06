import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { LiveViewTracker } from "./live-view-tracker";
import { ViewLogService } from "./view-log.service";
import { StatsController } from "./stats.controller";

@Global()
@Module({
    imports: [PrismaModule],
    controllers: [StatsController],
    providers: [LiveViewTracker, ViewLogService],
    exports: [LiveViewTracker, ViewLogService],
})
export class StatsModule {}
