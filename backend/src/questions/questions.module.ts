import { Module } from "@nestjs/common";
import { QuestionsController } from "./questions.controller";
import { QuestionsService } from "./questions.service";
import { ModeratorGuard } from "./moderator.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { TicketsModule } from "../tickets/tickets.module";
import { AuthGuardModule } from "../auth/auth-guard.module";
import { WebrtcModule } from "../webrtc-signaling/webrtc.module";

@Module({
    imports: [PrismaModule, TicketsModule, AuthGuardModule, WebrtcModule],
    controllers: [QuestionsController],
    providers: [QuestionsService, ModeratorGuard],
    exports: [QuestionsService],
})
export class QuestionsModule {}
