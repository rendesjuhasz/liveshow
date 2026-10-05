import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthGuardModule } from "../auth/auth-guard.module";
import { WsAuthModule } from "../auth/ws-auth.module";
import { IngestModule } from "../ingest/ingest.module";
import { StatsModule } from "../stats/stats.module";
import { AlertsController } from "./alerts.controller";
import { AlertsService } from "./alerts.service";
import { AlertsGateway } from "./alerts.gateway";

@Module({
    imports: [PrismaModule, AuthGuardModule, WsAuthModule, IngestModule, StatsModule],
    controllers: [AlertsController],
    providers: [AlertsGateway, AlertsService],
})
export class AlertsModule {}
