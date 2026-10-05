import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailVerifiedGuard } from "../auth/email-verified.guard";
import { AdminGuard } from "../admin/admin.guard";
import { MaintenanceDto } from "../dto/bodies";
import { MaintenanceService } from "./maintenance.service";

type Authed = { user: { id: string; email?: string; name?: string; role?: string } };

@Controller("admin/maintenance")
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminGuard)
export class MaintenanceAdminController {
    constructor(private readonly maintenance: MaintenanceService) {}

    @Get("catalog")
    catalog() {
        return this.maintenance.catalog();
    }

    @Get()
    list() {
        return this.maintenance.list(true);
    }

    @Get(":id")
    get(@Param("id") id: string) {
        return this.maintenance.get(id);
    }

    @Post()
    create(@Req() req: Authed, @Body() body: MaintenanceDto) {
        return this.maintenance.create(body as Record<string, unknown>, this.actor(req));
    }

    @Patch(":id")
    update(@Req() req: Authed, @Param("id") id: string, @Body() body: MaintenanceDto) {
        return this.maintenance.update(id, body as Record<string, unknown>, this.actor(req));
    }

    @Post(":id/close")
    close(@Req() req: Authed, @Param("id") id: string) {
        return this.maintenance.close(id, this.actor(req));
    }

    private actor(req: Authed) {
        return {
            id: req.user.id,
            name: String(req.user.name || req.user.email || "admin"),
            role: req.user.role,
        };
    }
}
