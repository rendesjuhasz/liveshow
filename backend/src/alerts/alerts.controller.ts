import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AlertsService } from "./alerts.service";
import { AlertSettingsDto, SnoozeDto } from "../dto/bodies";

type Authed = { user: { id: string; email?: string; role?: string } };

@Controller("alerts")
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class AlertsController {
    constructor(private readonly alerts: AlertsService) {}

    @Get()
    list(
        @Req() req: Authed,
        @Query("showId") showId?: string,
        @Query("status") status?: string,
        @Query("severity") severity?: string,
    ) {
        return this.alerts.list(req.user, { showId, status, severity });
    }

    @Get("history")
    history(
        @Req() req: Authed,
        @Query("showId") showId?: string,
        @Query("status") status?: string,
        @Query("severity") severity?: string,
    ) {
        return this.alerts.list(req.user, { showId, status, severity });
    }

    @Get("settings")
    settings(@Req() req: Authed) {
        return this.alerts.getPref(req.user);
    }

    @Put("settings")
    saveSettings(@Req() req: Authed, @Body() body: AlertSettingsDto) {
        return this.alerts.putPref(req.user, { ...(body || {}) } as Record<string, unknown>);
    }

    @Delete("resolved")
    removeResolved(@Req() req: Authed, @Query("showId") showId?: string) {
        return this.alerts.removeResolved(req.user, showId);
    }

    @Delete(":id")
    remove(@Req() req: Authed, @Param("id") id: string) {
        return this.alerts.remove(req.user, id);
    }

    @Post(":id/dismiss")
    dismiss(@Req() req: Authed, @Param("id") id: string) {
        return this.alerts.dismiss(req.user, id);
    }

    @Post(":id/snooze")
    snooze(@Req() req: Authed, @Param("id") id: string, @Body() body: SnoozeDto) {
        return this.alerts.snooze(req.user, id, body?.minutes);
    }
}
