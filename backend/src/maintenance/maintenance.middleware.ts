import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { MaintenanceService } from "./maintenance.service";
import { isAdminRole } from "../auth/roles";

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
    constructor(private readonly maintenance: MaintenanceService) {}

    async use(req: Request, _res: Response, next: NextFunction) {
        const user = (req as Request & { user?: { role?: string | null } }).user;
        try {
            await this.maintenance.assertRequestAllowed(
                String(req.originalUrl || req.url || req.path || "/"),
                String(req.method || "GET"),
                (req.body && typeof req.body === "object" ? req.body : null) as Record<string, unknown> | null,
                isAdminRole(user) ? user : undefined,
            );
            next();
        } catch (err) {
            next(err);
        }
    }
}
