import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentsModule } from "../payments/payments.module";
import { StreamersModule } from "../streamers/streamers.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { PrivateStreamsController } from "./private-streams.controller";
import { PrivateStreamsService } from "./private-streams.service";

@Module({
    imports: [PrismaModule, PaymentsModule, StreamersModule, AdminGuardModule],
    controllers: [PrivateStreamsController],
    providers: [PrivateStreamsService],
    exports: [PrivateStreamsService],
})
export class PrivateStreamsModule {}
