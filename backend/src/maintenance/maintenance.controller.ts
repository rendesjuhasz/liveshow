import { Controller, Get } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";

@Controller()
export class MaintenancePublicController {
    constructor(private readonly maintenance: MaintenanceService) {}

    @Get("maintenance/current")
    current() {
        return this.maintenance.currentPublic();
    }

    @Get("status")
    status() {
        return this.maintenance.publicStatus();
    }
}
