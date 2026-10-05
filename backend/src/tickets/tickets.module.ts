import { Module, forwardRef } from "@nestjs/common";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";
import { TicketGroupsService } from "./ticket-groups.service";
import { GiftCampaignsService } from "./gift-campaigns.service";
import { TicketCategoriesController } from "./ticket-categories.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentsModule } from "../payments/payments.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { AuthGuardModule } from "../auth/auth-guard.module";

@Module({
    imports: [PrismaModule, forwardRef(() => PaymentsModule), AdminGuardModule, AuthGuardModule],
    controllers: [TicketsController, TicketCategoriesController],
    providers: [TicketsService, GiftCampaignsService, TicketGroupsService],
    exports: [TicketsService, GiftCampaignsService, TicketGroupsService],
})
export class TicketsModule {}
