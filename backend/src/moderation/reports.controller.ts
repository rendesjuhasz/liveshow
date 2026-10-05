import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { ModeratorGuard } from "../questions/moderator.guard";
import { ReportsService } from "./reports.service";
import { ReportCreateDto, StatusNoteDto } from "../dto/bodies";

@Controller("reports")
export class ReportsController {
    constructor(private readonly reports: ReportsService) {}

    @Post()
    @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
    create(
        @Req() req: { user: { id: string } },
        @Body() body: ReportCreateDto,
    ) {
        return this.reports.create(req.user.id, body);
    }

    @Get()
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    list(@Query("status") status?: string) {
        return this.reports.listForModerator(status);
    }

    @Patch(":id")
    @UseGuards(JwtAuthGuard, ModeratorGuard)
    resolve(
        @Req() req: { user: { id: string } },
        @Param("id") id: string,
        @Body() body: StatusNoteDto,
    ) {
        return this.reports.resolve(req.user.id, id, body.status, body.note);
    }
}
