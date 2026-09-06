import { Module } from "@nestjs/common";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";
import { TicketGroupsService } from "./ticket-groups.service";
import { GiftCampaignsService } from "./gift-campaigns.service";
import { TicketCategoriesController } from "./ticket-categories.controller";
import { TicketCategoriesService } from "./ticket-categories.service";
import { PrismaModule } from "../prisma/prisma.module";
import { PaymentsModule } from "../payments/payments.module";
import { AdminGuardModule } from "../admin/admin-guard.module";

@Module({
    imports: [PrismaModule, PaymentsModule, AdminGuardModule],
    controllers: [TicketsController, TicketCategoriesController],
    providers: [TicketsService, TicketCategoriesService, GiftCampaignsService, TicketGroupsService],
    exports: [TicketsService, TicketCategoriesService, GiftCampaignsService, TicketGroupsService],
})
export class TicketsModule {}
