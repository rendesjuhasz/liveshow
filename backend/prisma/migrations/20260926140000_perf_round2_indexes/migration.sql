-- Catalog / archive / chat / search indexes (request path, no COALESCE wrappers).
CREATE INDEX IF NOT EXISTS "Show_status_live_idx" ON "Show" ("status", live);
CREATE INDEX IF NOT EXISTS "Show_status_featured_idx" ON "Show" ("status", featured);
CREATE INDEX IF NOT EXISTS "Show_isPrivate_idx" ON "Show" ("isPrivate");
CREATE INDEX IF NOT EXISTS "Review_showId_status_idx" ON "Review" ("showId", status);
CREATE INDEX IF NOT EXISTS "ContentTranslation_entityType_locale_idx" ON "ContentTranslation" ("entityType", locale);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "ContentTranslation_value_trgm_idx"
    ON "ContentTranslation" USING gin (value gin_trgm_ops);
