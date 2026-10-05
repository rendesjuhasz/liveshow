import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { AdminUsersService } from "./admin-users.service";
import { MailService } from "../mail/mail.service";
import { CampaignDto, CommissionDto, GiftTicketDto, SetRoleDto, ShowBodyDto, StatusDto } from "../dto/bodies";

@Controller("admin")
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
export class AdminController {
    constructor(
        private adminService: AdminService,
        private users: AdminUsersService,
        private readonly mail: MailService,
    ) {}

    @Get("emails")
    emails() {
        return this.mail.listRecent();
    }

    @Post("shows")
    createShow(@Body() body: ShowBodyDto) {
        return this.adminService.createShow(body);
    }

    @Get("shows")
    listShows() {
        return this.adminService.listShows();
    }

    @Get("shows/:id")
    getShow(@Param("id") id: string) {
        return this.adminService.getShow(id);
    }

    @Patch("shows/:id/status")
    setShowStatus(@Param("id") id: string, @Body() body: StatusDto) {
        return this.adminService.setShowStatus(id, body.status);
    }

    @Get("shows/:id/archive")
    getShowArchive(@Param("id") id: string) {
        return this.adminService.getShowArchive(id);
    }

    @Post("shows/:id/archive/regenerate")
    regenerateShowArchive(@Param("id") id: string) {
        return this.adminService.regenerateShowArchive(id);
    }

    @Delete("shows/:id/archive")
    deleteShowArchive(@Param("id") id: string) {
        return this.adminService.deleteShowArchive(id);
    }

    @Put("shows/:id")
    updateShow(@Param("id") id: string, @Body() body: ShowBodyDto) {
        return this.adminService.updateShow(id, body);
    }

    @Delete("shows/:id")
    deleteShow(@Param("id") id: string) {
        return this.adminService.deleteShow(id);
    }

    @Get("stats")
    stats() {
        return this.adminService.stats();
    }

    @Get("commission")
    getCommission() {
        return this.adminService.getCommission();
    }

    @Put("commission")
    setCommission(@Body() body: CommissionDto) {
        return this.adminService.setCommission(body);
    }

    @Get("tickets")
    tickets() {
        return this.adminService.listTickets();
    }

    @Post("tickets/gift")
    gift(@Body() body: GiftTicketDto) {
        return this.adminService.giftTicket(body.email, body.ticketCount);
    }

    @Post("tickets/:id/resend")
    resendTicket(@Req() req: { user: { id: string } }, @Param("id") id: string) {
        return this.adminService.resendTicketEmail(req.user.id, id);
    }

    @Get("campaigns")
    campaigns() {
        return this.adminService.listCampaigns();
    }

    @Post("campaigns")
    createCampaign(@Body() body: CampaignDto) {
        return this.adminService.createCampaign(body);
    }

    @Get("campaigns/:id")
    getCampaign(@Param("id") id: string) {
        return this.adminService.getCampaign(id);
    }

    @Patch("campaigns/:id")
    updateCampaign(@Param("id") id: string, @Body() body: CampaignDto) {
        return this.adminService.updateCampaign(id, body);
    }

    @Get("moderators")
    moderators() {
        return this.adminService.listModerators();
    }

    @Post("moderators")
    setRole(@Body() body: SetRoleDto) {
        return this.adminService.setUserRole(String(body.userId || body.email || ""), body.role);
    }

    @Get("users")
    listUsers() {
        return this.users.listUsers();
    }

    @Get("users/:id")
    userProfile(@Param("id") id: string) {
        return this.users.getUserProfile(id);
    }

    @Get("streamers")
    listStreamers() {
        return this.users.listStreamers();
    }

    @Patch("users/:id/status")
    setUserStatus(
        @Req() req: { user: { id: string; email?: string } },
        @Param("id") id: string,
        @Body() body: StatusDto,
    ) {
        return this.users.setUserStatus(req.user, id, body.status);
    }

    @Post("users/:id/ban")
    banUser(@Req() req: { user: { id: string; email?: string } }, @Param("id") id: string) {
        return this.users.setUserStatus(req.user, id, "banned");
    }

    @Post("users/:id/activate")
    activateUser(@Req() req: { user: { id: string; email?: string } }, @Param("id") id: string) {
        return this.users.setUserStatus(req.user, id, "active");
    }

    @Get("streamers/:id")
    streamerProfile(@Param("id") id: string) {
        return this.users.getStreamerProfile(id);
    }

    @Post("streamers/:id/approve")
    approveStreamer(@Req() req: { user: { id: string; email?: string } }, @Param("id") id: string) {
        return this.users.setStreamerStatus(req.user, id, "approved");
    }

    @Post("streamers/:id/reject")
    rejectStreamer(@Req() req: { user: { id: string; email?: string } }, @Param("id") id: string) {
        return this.users.setStreamerStatus(req.user, id, "rejected");
    }

    @Post("streamers/:id/ban")
    banStreamer(@Req() req: { user: { id: string; email?: string } }, @Param("id") id: string) {
        return this.users.setStreamerStatus(req.user, id, "banned");
    }

    @Post("streamers/:id/activate")
    activateStreamer(@Req() req: { user: { id: string; email?: string } }, @Param("id") id: string) {
        return this.users.setStreamerStatus(req.user, id, "approved");
    }
}
