import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { ReferralService } from "./referral.service";
import { ReferralController } from "./referral.controller";
import { ReferralAdminController } from "./referral-admin.controller";

@Module({
    imports: [PrismaModule, AdminGuardModule],
    controllers: [ReferralController, ReferralAdminController],
    providers: [ReferralService],
    exports: [ReferralService],
})
export class ReferralModule {}
