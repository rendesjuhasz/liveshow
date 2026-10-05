import { Injectable } from "@nestjs/common";
import { CACHE_TTL, PublicTtlCache } from "../cache/public-cache.module";
import { ShowsService } from "../shows/shows.service";
import { ArchiveService } from "../archive/archive.service";
import { FaqService } from "../faq/faq.service";

@Injectable()
export class HomeService {
    constructor(
        private readonly cache: PublicTtlCache,
        private readonly shows: ShowsService,
        private readonly archives: ArchiveService,
        private readonly faq: FaqService,
    ) {}

    async get(lang = "hu") {
        const locale = lang || "hu";
        const key = `home:${locale}`;
        const hit = this.cache.hasFresh(key);
        const body = await this.cache.getOrSet(key, CACHE_TTL.home, async () => {
            const [featured, live, shows, archives, popular, faq] = await Promise.all([
                this.shows.getFeaturedShows(locale).catch(() => []),
                this.shows.getLiveShows(locale).catch(() => []),
                this.shows.getAllShows(locale).catch(() => []),
                this.archives.listPublicArchives(locale, undefined, "newest").catch(() => []),
                this.archives.listPublicArchives(locale, undefined, "popular").catch(() => []),
                this.faq.listPublic().catch(() => []),
            ]);
            return {
                featured,
                live,
                shows,
                archives,
                popular: Array.isArray(popular) ? popular.slice(0, 18) : [],
                faq,
            };
        });
        return { body, hit, stats: this.cache.stats() };
    }
}
