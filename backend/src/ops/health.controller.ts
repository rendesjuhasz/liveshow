import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { OpsService } from "./ops.service";

@Controller("health")
export class HealthController {
    constructor(private readonly ops: OpsService) {}

    @Get()
    liveRoot() {
        return this.ops.live();
    }

    @Get("lan")
    lan() {
        return this.ops.lan();
    }

    @Get("ready")
    async ready(@Res({ passthrough: true }) res: Response) {
        const body = await this.ops.ready();
        res.status(body.status === "ok" ? 200 : 503);
        return body;
    }

    @Get("uptime")
    async uptime(@Res({ passthrough: true }) res: Response) {
        const body = await this.ops.uptimeBody();
        res.status(body.status === "ok" ? 200 : 503);
        return body;
    }

    @Get("livekit")
    async livekit(@Res({ passthrough: true }) res: Response) {
        const body = await this.ops.checkLivekit();
        res.status(body.status === "error" ? 503 : 200);
        return body;
    }
}
