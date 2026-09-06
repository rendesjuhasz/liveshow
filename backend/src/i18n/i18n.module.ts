import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { I18nService } from "./i18n.service";
import { I18nController } from "./i18n.controller";
import { I18nAdminController } from "./i18n-admin.controller";
import { I18nExceptionFilter } from "./i18n.exception.filter";

@Module({
    imports: [PrismaModule, AdminGuardModule],
    controllers: [I18nController, I18nAdminController],
    providers: [
        I18nService,
        { provide: APP_FILTER, useClass: I18nExceptionFilter },
    ],
    exports: [I18nService],
})
export class I18nModule {}
