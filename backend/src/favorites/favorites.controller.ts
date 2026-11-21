import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { FavoritesService } from "./favorites.service";

@Controller("favorites")
@UseGuards(JwtAuthGuard)
export class FavoritesController {
    constructor(private readonly favorites: FavoritesService) {}

    @Get()
    list(@Req() req: { user: { id: string } }) {
        return this.favorites.list(req.user.id);
    }

    @Post()
    add(@Req() req: { user: { id: string } }, @Body() body: { showId?: string }) {
        return this.favorites.add(req.user.id, body?.showId);
    }

    @Post("import")
    importGuest(
        @Req() req: { user: { id: string } },
        @Body() body: { showIds?: string[] },
    ) {
        return this.favorites.importIds(req.user.id, body?.showIds);
    }

    @Delete(":showId")
    remove(@Req() req: { user: { id: string } }, @Param("showId") showId: string) {
        return this.favorites.remove(req.user.id, showId);
    }
}
