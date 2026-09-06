import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../admin/admin.guard";
import { ReferralService } from "./referral.service";

@Controller("admin/referrals")
@UseGuards(JwtAuthGuard, AdminGuard)
export class ReferralAdminController {
    constructor(private readonly referrals: ReferralService) {}

    @Get()
    list() {
        return this.referrals.adminList();
    }

    @Get("stats")
    stats() {
        return this.referrals.adminStats();
    }

    @Get("gifts")
    gifts() {
        return this.referrals.giftTicketStats();
    }

    @Get("settings")
    settings() {
        return this.referrals.getSettings();
    }

    @Patch("settings")
    updateSettings(
        @Body()
        body: {
            enabled?: boolean;
            minimumPurchasedTickets?: number;
            rewardTicketAmount?: number;
            allowMultipleFromReferrer?: boolean;
        },
    ) {
        return this.referrals.updateSettings(body);
    }
}
