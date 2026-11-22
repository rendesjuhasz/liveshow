CREATE TABLE IF NOT EXISTS "ShowWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "watchedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "ShowWatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShowWatch_userId_showId_key" ON "ShowWatch"("userId", "showId");
CREATE INDEX IF NOT EXISTS "ShowWatch_userId_watchedAt_idx" ON "ShowWatch"("userId", "watchedAt");
