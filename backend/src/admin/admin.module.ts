import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminUsersService } from "./admin-users.service";
import { AdminGuardModule } from "./admin-guard.module";
import { ShowsModule } from "../shows/shows.module";
import { ArchiveModule } from "../archive/archive.module";
import { TicketsModule } from "../tickets/tickets.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReferralModule } from "../referrals/referral.module";

@Module({
    imports: [ShowsModule, ArchiveModule, AdminGuardModule, PrismaModule, TicketsModule, ReferralModule],
    controllers: [AdminController],
    providers: [AdminService, AdminUsersService],
})
export class AdminModule {}
