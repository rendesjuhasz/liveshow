import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthGuardModule } from "../auth/auth-guard.module";
import { OpsModule } from "../ops/ops.module";
import { StreamerApprovedGuard } from "../streamers/streamer-approved.guard";
import { PreflightController } from "./preflight.controller";
import { PreflightService } from "./preflight.service";

@Module({
    imports: [PrismaModule, AuthGuardModule, OpsModule],
    controllers: [PreflightController],
    providers: [PreflightService, StreamerApprovedGuard],
})
export class PreflightModule {}
