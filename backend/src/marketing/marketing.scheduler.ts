import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { MarketingService } from "./marketing.service";
import { MarketingAutoService } from "./marketing-auto.service";

@Injectable()
export class MarketingScheduler implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MarketingScheduler.name);
    private timer: ReturnType<typeof setInterval> | null = null;
    private autoTimer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly marketing: MarketingService,
        private readonly auto: MarketingAutoService,
    ) {}

    onModuleInit() {
        this.timer = setInterval(() => {
            this.marketing.processDueJobs().catch((err) =>
                this.logger.warn(`Marketing publish scheduler: ${err?.message || err}`),
            );
        }, 20_000);
        this.autoTimer = setInterval(() => {
            this.auto.tick().catch((err) => this.logger.warn(`Marketing auto: ${err?.message || err}`));
        }, 15_000);
        setTimeout(() => this.auto.ensure().catch(() => undefined), 2000);
        setTimeout(() => this.auto.tick().catch(() => undefined), 8000);
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
        if (this.autoTimer) clearInterval(this.autoTimer);
    }
}
