import { randomUUID } from "crypto";
import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
    DEFAULT_LOCALE,
    detectLocale,
    isLocale,
    LOCALE_META,
    LOCALES,
    MESSAGES,
    translate,
    type Locale,
} from "./messages";
import { CACHE_TTL, PublicTtlCache } from "../cache/public-cache.module";

@Injectable()
export class I18nService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly publicCache: PublicTtlCache,
    ) {}

    async onModuleInit() {
        await this.ensureSchema();
        await this.seed();
    }

    resolveLocale(input?: string | null, acceptLanguage?: string | null) {
        if (isLocale(input)) return input;
        return detectLocale(acceptLanguage);
    }

    t(key: string, locale?: string | null) {
        return translate(key, locale);
    }

    async publicLanguages() {
        return this.publicCache.getOrSet("i18n:languages", CACHE_TTL.i18n, () => this.loadPublicLanguages());
    }

    private async loadPublicLanguages() {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT code, name, "nativeName", enabled, "isDefault", "sortOrder"
            FROM "AppLanguage"
            WHERE enabled = TRUE
            ORDER BY "sortOrder" ASC
        `.catch(() => []);
        if (rows.length) return rows;
        return LOCALES.map((code, i) => ({
            code,
            name: LOCALE_META[code].name,
            nativeName: LOCALE_META[code].nativeName,
            enabled: true,
            isDefault: code === DEFAULT_LOCALE,
            sortOrder: i,
        }));
    }

    async catalog(locale?: string | null) {
        const lang = this.resolveLocale(locale);
        return this.publicCache.getOrSet(`i18n:catalog:${lang}`, CACHE_TTL.i18n, () => this.loadCatalog(lang));
    }

    private async loadCatalog(lang: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT key, value FROM "UiTranslation"
            WHERE locale = ${lang} AND status = 'approved'
        `.catch(() => []);
        const dict: Record<string, string> = {};
        for (const key of Object.keys(MESSAGES)) {
            dict[key] = translate(key, lang);
        }
        for (const row of rows) {
            if (row.key && row.value) dict[row.key] = String(row.value);
        }
        return {
            locale: lang,
            fallback: DEFAULT_LOCALE,
            languages: await this.publicLanguages(),
            messages: dict,
        };
    }

    async setUiTranslation(body: {
        key: string;
        locale: string;
        value: string;
        status?: string;
        userId?: string;
    }) {
        const key = String(body.key || "").trim();
        const locale = this.resolveLocale(body.locale);
        const value = String(body.value || "");
        const status = body.status === "draft" ? "draft" : "approved";
        if (!key) throw new BadRequestException("A fordítási kulcs kötelező.");
        const existing = await this.prisma.$queryRaw<any[]>`
            SELECT id FROM "UiTranslation" WHERE key = ${key} AND locale = ${locale} LIMIT 1
        `;
        if (existing[0]) {
            await this.prisma.$executeRaw`
                UPDATE "UiTranslation"
                SET value = ${value}, status = ${status}, "updatedBy" = ${body.userId || null}, "updatedAt" = NOW()
                WHERE key = ${key} AND locale = ${locale}
            `;
        } else {
            await this.prisma.$executeRaw`
                INSERT INTO "UiTranslation" (id, key, locale, value, status, "updatedAt", "updatedBy")
                VALUES (${randomUUID()}, ${key}, ${locale}, ${value}, ${status}, NOW(), ${body.userId || null})
            `;
        }
        await this.prisma.$executeRaw`
            INSERT INTO "TranslationVersion" (id, key, locale, value, status, "createdAt", "createdBy")
            VALUES (${randomUUID()}, ${key}, ${locale}, ${value}, ${status}, NOW(), ${body.userId || null})
        `;
        this.publicCache.deletePrefix("i18n:");
        this.publicCache.deletePrefix("home:");
        return { key, locale, value, status };
    }

    async approve(key: string, locale: string, userId?: string) {
        return this.setUiTranslation({ key, locale, value: (await this.lookup(key, locale)) || "", status: "approved", userId });
    }

    async lookup(key: string, locale: string) {
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT value FROM "UiTranslation" WHERE key = ${key} AND locale = ${locale} LIMIT 1
        `.catch(() => []);
        return rows[0]?.value ? String(rows[0].value) : translate(key, locale);
    }

    async versions(key: string, locale: string) {
        return this.prisma.$queryRaw<any[]>`
            SELECT id, value, status, "createdAt", "createdBy"
            FROM "TranslationVersion"
            WHERE key = ${key} AND locale = ${locale}
            ORDER BY "createdAt" DESC
            LIMIT 40
        `.catch(() => []);
    }

    async setContent(body: {
        entityType: string;
        entityId: string;
        field: string;
        locale: string;
        value: string;
    }) {
        const locale = this.resolveLocale(body.locale);
        await this.prisma.$executeRaw`
            INSERT INTO "ContentTranslation" (id, "entityType", "entityId", field, locale, value)
            VALUES (${randomUUID()}, ${body.entityType}, ${body.entityId}, ${body.field}, ${locale}, ${body.value})
            ON CONFLICT ("entityType", "entityId", field, locale)
            DO UPDATE SET value = ${body.value}
        `;
        return body;
    }

    async contentMap(entityType: string, ids: string[], locale: string) {
        if (!ids.length) return new Map<string, Record<string, string>>();
        const lang = this.resolveLocale(locale);
        const placeholders = ids.map((_, i) => `$${i + 3}`).join(", ");
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT "entityId", field, value FROM "ContentTranslation"
             WHERE "entityType" = $1 AND locale = $2 AND "entityId" IN (${placeholders})`,
            entityType,
            lang,
            ...ids,
        ).catch(() => []);
        const map = new Map<string, Record<string, string>>();
        for (const row of rows) {
            const cur = map.get(row.entityId) || {};
            cur[row.field] = row.value;
            map.set(row.entityId, cur);
        }
        return map;
    }

    async localizeShows<T extends { id: string; title?: string | null; description?: string | null }>(
        shows: T[],
        locale?: string | null,
    ) {
        const lang = this.resolveLocale(locale);
        if (lang === DEFAULT_LOCALE) return shows;
        const map = await this.contentMap("show", shows.map((s) => s.id), lang);
        return shows.map((show) => {
            const hit = map.get(show.id) || {};
            return {
                ...show,
                title: hit.title || show.title,
                description: hit.description || show.description,
                locale: lang,
            };
        });
    }

    async searchContentIds(entityType: string, needle: string, locale: string) {
        const lang = this.resolveLocale(locale);
        const like = `%${needle}%`;
        const rows = await this.prisma.$queryRaw<any[]>`
            SELECT DISTINCT "entityId" FROM "ContentTranslation"
            WHERE "entityType" = ${entityType}
              AND (locale = ${lang} OR locale = ${DEFAULT_LOCALE})
              AND value ILIKE ${like}
        `.catch(() => []);
        return new Set(rows.map((row) => String(row.entityId)));
    }

    async logMissing(key: string, locale: string) {
        const loc = this.resolveLocale(locale);
        const k = String(key || "").trim();
        if (!k) return;
        await this.prisma.$executeRaw`
            INSERT INTO "MissingTranslation" (id, key, locale, hits, "updatedAt")
            VALUES (${randomUUID()}, ${k}, ${loc}, 1, NOW())
            ON CONFLICT (key, locale)
            DO UPDATE SET hits = "MissingTranslation".hits + 1, "updatedAt" = NOW()
        `.catch(() => undefined);
    }

    async stats() {
        const keys = Object.keys(MESSAGES);
        const missing = await this.prisma.$queryRaw<any[]>`
            SELECT key, locale, hits FROM "MissingTranslation" ORDER BY hits DESC LIMIT 100
        `.catch(() => []);
        const coverage = await this.prisma.$queryRaw<any[]>`
            SELECT locale, COUNT(*)::int AS count
            FROM "UiTranslation"
            WHERE status = 'approved'
            GROUP BY locale
        `.catch(() => []);
        return {
            catalogKeys: keys.length,
            locales: LOCALES,
            coverage: coverage.map((row) => ({
                locale: row.locale,
                approved: row.count,
                percent: Math.round((Number(row.count) / Math.max(1, keys.length)) * 100),
            })),
            missing,
        };
    }

    async allLanguages() {
        return this.prisma.$queryRaw<any[]>`
            SELECT code, name, "nativeName", enabled, "isDefault", "sortOrder"
            FROM "AppLanguage"
            ORDER BY "sortOrder" ASC
        `.catch(() => this.publicLanguages());
    }

    async contentFor(entityType: string, entityId: string) {
        return this.prisma.$queryRaw<any[]>`
            SELECT field, locale, value FROM "ContentTranslation"
            WHERE "entityType" = ${entityType} AND "entityId" = ${entityId}
        `.catch(() => []);
    }

    async listAdmin() {
        return this.prisma.$queryRaw<any[]>`
            SELECT key, locale, value, status, "updatedAt" FROM "UiTranslation"
            ORDER BY key ASC, locale ASC
            LIMIT 2000
        `.catch(() => []);
    }

    async upsertLanguage(body: { code: string; name: string; nativeName?: string; enabled?: boolean }) {
        const code = String(body.code || "").trim().toLowerCase();
        if (!/^[a-z]{2,5}$/.test(code)) throw new BadRequestException("Érvénytelen nyelvkód.");
        await this.prisma.$executeRaw`
            INSERT INTO "AppLanguage" (code, name, "nativeName", enabled, "isDefault", "sortOrder")
            VALUES (${code}, ${body.name}, ${body.nativeName || body.name}, ${body.enabled !== false}, FALSE, 50)
            ON CONFLICT (code) DO UPDATE SET
                name = ${body.name},
                "nativeName" = ${body.nativeName || body.name},
                enabled = ${body.enabled !== false}
        `;
        return this.publicLanguages();
    }

    async setLanguageEnabled(code: string, enabled: boolean) {
        if (code === DEFAULT_LOCALE && !enabled) {
            throw new BadRequestException("A magyar alapnyelv nem tiltható.");
        }
        await this.prisma.$executeRaw`
            UPDATE "AppLanguage" SET enabled = ${enabled} WHERE code = ${code}
        `;
        return this.publicLanguages();
    }

    async tracks(showId: string) {
        return this.prisma.$queryRaw<any[]>`
            SELECT id, kind, locale, label, url, "isDefault"
            FROM "ShowMediaTrack" WHERE "showId" = ${showId}
            ORDER BY kind, locale
        `.catch(() => []);
    }

    async saveTrack(showId: string, body: { kind: string; locale: string; label: string; url: string; isDefault?: boolean }) {
        const kind = body.kind === "audio" ? "audio" : "subtitle";
        const id = randomUUID();
        await this.prisma.$executeRaw`
            INSERT INTO "ShowMediaTrack" (id, "showId", kind, locale, label, url, "isDefault")
            VALUES (${id}, ${showId}, ${kind}, ${this.resolveLocale(body.locale)}, ${body.label}, ${body.url}, ${Boolean(body.isDefault)})
        `;
        return { id, ...body, kind };
    }

    private async seed() {
        for (const [i, code] of LOCALES.entries()) {
            const meta = LOCALE_META[code];
            await this.prisma.$executeRaw`
                INSERT INTO "AppLanguage" (code, name, "nativeName", enabled, "isDefault", "sortOrder")
                VALUES (${code}, ${meta.name}, ${meta.nativeName}, TRUE, ${code === DEFAULT_LOCALE}, ${i})
                ON CONFLICT (code) DO NOTHING
            `.catch(() => undefined);
        }
        for (const [key, values] of Object.entries(MESSAGES)) {
            for (const locale of LOCALES) {
                await this.prisma.$executeRaw`
                    INSERT INTO "UiTranslation" (id, key, locale, value, status, "updatedAt")
                    VALUES (${randomUUID()}, ${key}, ${locale}, ${values[locale]}, 'approved', NOW())
                    ON CONFLICT (key, locale) DO NOTHING
                `.catch(() => undefined);
            }
        }
    }

    private async ensureSchema() {
        const stmts = [
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'hu'`,
            `CREATE TABLE IF NOT EXISTS "AppLanguage" (
                "code" TEXT PRIMARY KEY,
                "name" TEXT NOT NULL,
                "nativeName" TEXT NOT NULL,
                "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
                "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
                "sortOrder" INTEGER NOT NULL DEFAULT 0
            )`,
            `CREATE TABLE IF NOT EXISTS "UiTranslation" (
                "id" TEXT PRIMARY KEY,
                "key" TEXT NOT NULL,
                "locale" TEXT NOT NULL,
                "value" TEXT NOT NULL,
                "status" TEXT NOT NULL DEFAULT 'approved',
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedBy" TEXT
            )`,
            `CREATE UNIQUE INDEX IF NOT EXISTS "UiTranslation_key_locale_key" ON "UiTranslation"(key, locale)`,
            `CREATE TABLE IF NOT EXISTS "TranslationVersion" (
                "id" TEXT PRIMARY KEY,
                "key" TEXT NOT NULL,
                "locale" TEXT NOT NULL,
                "value" TEXT NOT NULL,
                "status" TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "createdBy" TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS "ContentTranslation" (
                "id" TEXT PRIMARY KEY,
                "entityType" TEXT NOT NULL,
                "entityId" TEXT NOT NULL,
                "field" TEXT NOT NULL,
                "locale" TEXT NOT NULL,
                "value" TEXT NOT NULL
            )`,
            `CREATE UNIQUE INDEX IF NOT EXISTS "ContentTranslation_uniq" ON "ContentTranslation"("entityType","entityId",field,locale)`,
            `CREATE TABLE IF NOT EXISTS "MissingTranslation" (
                "id" TEXT PRIMARY KEY,
                "key" TEXT NOT NULL,
                "locale" TEXT NOT NULL,
                "hits" INTEGER NOT NULL DEFAULT 1,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE UNIQUE INDEX IF NOT EXISTS "MissingTranslation_key_locale_key" ON "MissingTranslation"(key, locale)`,
            `CREATE TABLE IF NOT EXISTS "ShowMediaTrack" (
                "id" TEXT PRIMARY KEY,
                "showId" TEXT NOT NULL,
                "kind" TEXT NOT NULL,
                "locale" TEXT NOT NULL,
                "label" TEXT NOT NULL,
                "url" TEXT NOT NULL,
                "isDefault" BOOLEAN NOT NULL DEFAULT FALSE
            )`,
        ];
        for (const sql of stmts) {
            await this.prisma.$executeRawUnsafe(sql).catch(() => undefined);
        }
    }
}
