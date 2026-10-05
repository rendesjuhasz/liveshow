ALTER TABLE "Archive" ADD COLUMN IF NOT EXISTS duration INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "archiveExists" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "archiveSize" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "archiveDuration" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "archiveCreatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Show_archiveExists_idx" ON "Show" ("archiveExists");

UPDATE "Show" AS s
SET
    "archiveExists" = true,
    "archiveSize" = COALESCE(a.size, 0),
    "archiveDuration" = COALESCE(a.duration, 0),
    "archiveCreatedAt" = a."createdAt"
FROM "Archive" AS a
WHERE a."showId" = s.id AND COALESCE(a.size, 0) >= 1024;
