import { Module } from "@nestjs/common";
import { WebrtcGateway } from "./webrtc.gateway";
import { WsAuthModule } from "../auth/ws-auth.module";
import { TicketsModule } from "../tickets/tickets.module";
import { PrismaModule } from "../prisma/prisma.module";
import { LivePreviewService } from "./live-preview.service";
import { LivePreviewController } from "./live-preview.controller";
import { LiveVideoSessionModule } from "../livekit/live-video-session.module";

@Module({
    imports: [WsAuthModule, TicketsModule, PrismaModule, LiveVideoSessionModule],
    controllers: [LivePreviewController],
    providers: [LivePreviewService, WebrtcGateway],
    exports: [WebrtcGateway],
})
export class WebrtcModule {}
