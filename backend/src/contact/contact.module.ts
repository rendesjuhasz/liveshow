import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminGuardModule } from "../admin/admin-guard.module";
import { ContactController } from "./contact.controller";
import { ContactService } from "./contact.service";

@Module({
    imports: [PrismaModule, AdminGuardModule],
    controllers: [ContactController],
    providers: [ContactService],
    exports: [ContactService],
})
export class ContactModule {}
