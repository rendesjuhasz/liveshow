import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReferralService } from "./referral.service";

@Controller("referrals")
@UseGuards(JwtAuthGuard)
export class ReferralController {
    constructor(private readonly referrals: ReferralService) {}

    @Get("me")
    me(@Req() req: { user: { id: string } }) {
        return this.referrals.myOverview(req.user.id);
    }
}
