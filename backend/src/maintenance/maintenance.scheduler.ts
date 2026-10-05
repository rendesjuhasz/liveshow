import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";

@Injectable()
export class MaintenanceScheduler implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MaintenanceScheduler.name);
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor(private readonly maintenance: MaintenanceService) {}

    onModuleInit() {
        this.timer = setInterval(() => {
            this.maintenance.tick().catch((err) => this.logger.warn(`Maintenance tick: ${err?.message || err}`));
        }, 15_000);
        setTimeout(() => this.maintenance.tick().catch(() => undefined), 1500);
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
    }
}
