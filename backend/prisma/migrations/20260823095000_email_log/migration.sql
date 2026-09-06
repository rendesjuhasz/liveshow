CREATE TABLE IF NOT EXISTS "EmailLog" (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    "relatedId" TEXT,
    status TEXT NOT NULL DEFAULT 'logged',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailLog_dedupe"
ON "EmailLog" (type, "toEmail", COALESCE("relatedId", ''));
