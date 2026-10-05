ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'new';
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "admin_note" TEXT NOT NULL DEFAULT '';

UPDATE "contact_messages" SET "status" = 'new' WHERE "status" IS NULL OR "status" = '';

CREATE INDEX IF NOT EXISTS "contact_messages_status_idx" ON "contact_messages" ("status");
CREATE INDEX IF NOT EXISTS "contact_messages_created_at_idx" ON "contact_messages" ("created_at");
