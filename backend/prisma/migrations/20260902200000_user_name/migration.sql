ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;

UPDATE "User" AS u
SET name = s.name
FROM "Streamer" AS s
WHERE s."userId" = u.id
  AND (u.name IS NULL OR btrim(u.name) = '');
