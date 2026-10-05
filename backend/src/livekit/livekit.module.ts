import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { TicketsModule } from "../tickets/tickets.module";
import { LivekitController } from "./livekit.controller";
import { LivekitService } from "./livekit.service";
import { LiveVideoSessionModule } from "./live-video-session.module";

@Module({
    imports: [PrismaModule, TicketsModule, LiveVideoSessionModule],
    controllers: [LivekitController],
    providers: [LivekitService],
    exports: [LivekitService],
})
export class LivekitModule {}
