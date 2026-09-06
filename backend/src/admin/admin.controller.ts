import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { AdminUsersService } from "./admin-users.service";
import { MailService } from "../mail/mail.service";

type ShowBody = {
    title: string;
    description?: string;
    image?: string;
    date?: string;
    startTime?: string;
    price?: number;
    live?: boolean;
    featured?: boolean;
    streamUrl?: string;
    streamId?: string;
    streamerId?: string;
    categoryKeys?: string[];
    videoCategory?: string;
    status?: string;
    commissionPercent?: number | null;
};

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
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
    createShow(@Body() body: ShowBody) {
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
    setShowStatus(@Param("id") id: string, @Body() body: { status?: string }) {
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
    updateShow(@Param("id") id: string, @Body() body: ShowBody) {
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
    setCommission(@Body() body: { percent?: number; commissionPercent?: number; streamerPercent?: number; payoutCycle?: string }) {
        return this.adminService.setCommission(body);
    }

    @Get("tickets")
    tickets() {
        return this.adminService.listTickets();
    }

    @Post("tickets/gift")
    gift(@Body() body: { email?: string; showId?: string; categoryKey?: string }) {
        return this.adminService.giftTicket(body.email, body.showId, body.categoryKey);
    }

    @Get("campaigns")
    campaigns() {
        return this.adminService.listCampaigns();
    }

    @Post("campaigns")
    createCampaign(
        @Body()
        body: {
            name?: string;
            type?: string;
            showId?: string;
            categoryKey?: string;
            maxClaims?: number;
            status?: string;
            startsAt?: string | null;
            endsAt?: string | null;
        },
    ) {
        return this.adminService.createCampaign(body);
    }

    @Get("campaigns/:id")
    getCampaign(@Param("id") id: string) {
        return this.adminService.getCampaign(id);
    }

    @Patch("campaigns/:id")
    updateCampaign(
        @Param("id") id: string,
        @Body()
        body: {
            name?: string;
            maxClaims?: number;
            status?: string;
            startsAt?: string | null;
            endsAt?: string | null;
            categoryKey?: string;
        },
    ) {
        return this.adminService.updateCampaign(id, body);
    }

    @Get("moderators")
    moderators() {
        return this.adminService.listModerators();
    }

    @Post("moderators")
    setRole(@Body() body: { userId?: string; email?: string; role?: string }) {
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
        @Body() body: { status?: string },
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
