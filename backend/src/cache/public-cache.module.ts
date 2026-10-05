import { Global, Injectable, Module } from "@nestjs/common";
import { TtlCache } from "./ttl-cache";

/** Public catalog / FAQ / i18n — 30–60s TTL, request pathen nincs schema munka. */
export const CACHE_TTL = {
    live: 30_000,
    featured: 45_000,
    shows: 45_000,
    archives: 45_000,
    home: 30_000,
    faq: 60_000,
    i18n: 60_000,
} as const;

@Injectable()
export class PublicTtlCache extends TtlCache {}

@Global()
@Module({
    providers: [PublicTtlCache],
    exports: [PublicTtlCache],
})
export class PublicCacheModule {}
