import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { OpsService } from "./ops.service";

@Controller("admin/ops")
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
export class OpsAdminController {
    constructor(private readonly ops: OpsService) {}

    @Get()
    dashboard() {
        return this.ops.dashboard();
    }
}
