import { Module } from "@nestjs/common";
import { StreamersController } from "./streamers.controller";
import { StreamersService } from "./streamers.service";
import { StreamerDashboardController } from "./streamer-dashboard.controller";
import { StreamerDashboardService } from "./streamer-dashboard.service";
import { StreamerApprovedGuard } from "./streamer-approved.guard";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";
import { ModeratorGuard } from "../questions/moderator.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { IngestModule } from "../ingest/ingest.module";
import { ArchiveModule } from "../archive/archive.module";
import { TicketsModule } from "../tickets/tickets.module";
import { QuestionsModule } from "../questions/questions.module";
import { PayoutsModule } from "../payouts/payouts.module";

@Module({
    imports: [PrismaModule, AdminGuardModule, IngestModule, ArchiveModule, TicketsModule, QuestionsModule, PayoutsModule],
    controllers: [StreamersController, StreamerDashboardController, ReviewsController],
    providers: [StreamersService, StreamerDashboardService, StreamerApprovedGuard, ReviewsService, ModeratorGuard],
    exports: [StreamersService, StreamerApprovedGuard],
})
export class StreamersModule {}
