import { randomUUID } from "crypto";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./messages";

export type ShowTranslationInput = {
    locale?: string;
    title?: string;
    description?: string;
};

export type ShowTranslationDto = {
    locale: Locale;
    title: string;
    description: string;
};

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 8000;

export function resolveOriginalLocale(value?: string | null): Locale {
    const locale = String(value || "").toLowerCase();
    return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function translationLocales(originalLocale?: string | null): Locale[] {
    const original = resolveOriginalLocale(originalLocale);
    return LOCALES.filter((locale) => locale !== original);
}

export function groupShowTranslations(
    rows: { field?: string; locale?: string; value?: string }[],
    originalLocale?: string | null,
): ShowTranslationDto[] {
    const slots = translationLocales(originalLocale);
    const original = resolveOriginalLocale(originalLocale);
    const byLocale = new Map<string, ShowTranslationDto>();
    for (const locale of slots) {
        byLocale.set(locale, { locale, title: "", description: "" });
    }
    for (const row of rows) {
        const locale = String(row.locale || "").toLowerCase();
        if (!isLocale(locale) || locale === original) continue;
        const cur = byLocale.get(locale) || { locale, title: "", description: "" };
        const value = String(row.value || "");
        if (row.field === "title") cur.title = value;
        if (row.field === "description") cur.description = value;
        byLocale.set(locale, cur);
    }
    return slots.map((locale) => byLocale.get(locale)!);
}

function clip(value: string, max: number) {
    return value.slice(0, max);
}

export function normalizeShowTranslations(
    input?: ShowTranslationInput[] | null,
    originalLocale?: string | null,
): ShowTranslationInput[] {
    const original = resolveOriginalLocale(originalLocale);
    if (!Array.isArray(input)) return [];
    return input
        .map((row) => ({
            locale: String(row?.locale || "").toLowerCase(),
            title: row?.title === undefined ? undefined : clip(String(row.title), TITLE_MAX),
            description: row?.description === undefined ? undefined : clip(String(row.description), DESCRIPTION_MAX),
        }))
        .filter((row) => isLocale(row.locale) && row.locale !== original);
}

export function localizeShowCopy<T extends { title?: string | null; description?: string | null; originalLocale?: string | null }>(
    show: T,
    viewerLocale: string,
    hit: Record<string, string> = {},
) {
    const original = resolveOriginalLocale(show.originalLocale);
    const lang = isLocale(viewerLocale) ? viewerLocale : DEFAULT_LOCALE;
    const titleHit = String(hit.title || "").trim();
    const descriptionHit = String(hit.description || "").trim();
    const hasTranslation = Boolean(titleHit || descriptionHit);
    const useTranslation = lang !== original && hasTranslation;
    return {
        originalLocale: original,
        contentTranslated: useTranslation,
        title: useTranslation && titleHit ? titleHit : show.title,
        description: useTranslation && descriptionHit ? descriptionHit : show.description,
    };
}

type PrismaExec = {
    $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

export async function persistShowContentTranslations(
    prisma: PrismaExec,
    showId: string,
    translations?: ShowTranslationInput[] | null,
    originalLocale?: string | null,
) {
    const original = resolveOriginalLocale(originalLocale);
    await prisma.$executeRaw`
        DELETE FROM "ContentTranslation"
        WHERE "entityType" = ${"show"}
          AND "entityId" = ${showId}
          AND locale = ${original}
    `;
    const rows = normalizeShowTranslations(translations, original);
    let written = 1;
    for (const row of rows) {
        written += await upsertField(prisma, showId, "title", row.locale!, row.title);
        written += await upsertField(prisma, showId, "description", row.locale!, row.description);
    }
    return { written };
}

async function upsertField(
    prisma: PrismaExec,
    showId: string,
    field: "title" | "description",
    locale: string,
    value: string | undefined,
) {
    if (value === undefined) return 0;
    const trimmed = value.trim();
    if (!trimmed) {
        await prisma.$executeRaw`
            DELETE FROM "ContentTranslation"
            WHERE "entityType" = ${"show"}
              AND "entityId" = ${showId}
              AND field = ${field}
              AND locale = ${locale}
        `;
        return 1;
    }
    const id = randomUUID();
    await prisma.$executeRaw`
        INSERT INTO "ContentTranslation" (id, "entityType", "entityId", field, locale, value)
        VALUES (${id}, ${"show"}, ${showId}, ${field}, ${locale}, ${trimmed})
        ON CONFLICT ("entityType", "entityId", field, locale)
        DO UPDATE SET value = ${trimmed}
    `;
    return 1;
}
