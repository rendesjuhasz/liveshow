import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { ReferralService } from "./referral.service";
import { ReferralSettingsDto } from "../dto/bodies";

@Controller("admin/referrals")
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
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
        @Body() body: ReferralSettingsDto,
    ) {
        return this.referrals.updateSettings(body);
    }
}
