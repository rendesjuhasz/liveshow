-- Catalog lookup indexes (moved off request-path CREATE INDEX / seq scans)
CREATE INDEX IF NOT EXISTS "Show_status_idx" ON "Show"("status");
CREATE INDEX IF NOT EXISTS "Show_live_idx" ON "Show"("live");
CREATE INDEX IF NOT EXISTS "Show_featured_idx" ON "Show"("featured");
CREATE INDEX IF NOT EXISTS "Show_startTime_idx" ON "Show"("startTime");
CREATE INDEX IF NOT EXISTS "Show_streamerId_idx" ON "Show"("streamerId");
CREATE INDEX IF NOT EXISTS "Show_videoCategory_idx" ON "Show"("videoCategory");
