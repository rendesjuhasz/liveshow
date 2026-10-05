import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthGuardModule } from "../auth/auth-guard.module";
import { QuestionsModule } from "../questions/questions.module";
import { WebrtcModule } from "../webrtc-signaling/webrtc.module";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";
import { ModeratorGuard } from "../questions/moderator.guard";

@Module({
    imports: [PrismaModule, AuthGuardModule, QuestionsModule, WebrtcModule],
    controllers: [ReportsController, ChatController],
    providers: [ReportsService, ChatService, ModeratorGuard],
    exports: [ReportsService, ChatService],
})
export class ModerationModule {}
