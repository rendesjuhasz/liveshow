import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { BackupService } from "./backup.service";

@Controller("admin/backups")
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
export class BackupController {
    constructor(private readonly backups: BackupService) {}

    @Get()
    status() {
        return this.backups.status();
    }

    @Post("run")
    run() {
        return this.backups.run({ automatic: false });
    }

    @Post(":id/verify")
    verify(@Param("id") id: string) {
        return this.backups.verifySnapshot(id);
    }

    @Post(":id/offsite")
    offsite(@Param("id") id: string) {
        return this.backups.uploadOffsite(id);
    }
}
