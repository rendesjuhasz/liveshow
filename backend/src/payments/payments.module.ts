import { Module, forwardRef } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { BarionController } from "./barion.controller";
import { PaymentsService } from "./payments.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { ReferralModule } from "../referrals/referral.module";
import { AuthGuardModule } from "../auth/auth-guard.module";
import { TicketsModule } from "../tickets/tickets.module";

@Module({
    imports: [PrismaModule, AdminGuardModule, ReferralModule, AuthGuardModule, forwardRef(() => TicketsModule)],
    controllers: [PaymentsController, BarionController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule {}
