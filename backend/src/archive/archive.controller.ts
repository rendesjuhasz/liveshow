import {
    Controller,
    Delete,
    Get,
    Param,
    Post,
    UseGuards,
} from "@nestjs/common";
import { ArchiveService } from "./archive.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../admin/admin.guard";

@Controller("archive")
@UseGuards(JwtAuthGuard, AdminGuard)
export class ArchiveController {
    constructor(private readonly archiveService: ArchiveService) {}

    @Get(":showId")
    getArchive(@Param("showId") showId: string) {
        return this.archiveService.getArchive(showId);
    }

    @Post("generate/:showId")
    generate(@Param("showId") showId: string) {
        return this.archiveService.generateArchive(showId);
    }

    @Post("regenerate/:showId")
    regenerate(@Param("showId") showId: string) {
        return this.archiveService.generateArchive(showId);
    }

    @Delete(":showId")
    delete(@Param("showId") showId: string) {
        return this.archiveService.deleteArchive(showId);
    }
}
