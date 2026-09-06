CREATE TABLE IF NOT EXISTS "ViewEvent" (
    "id" TEXT NOT NULL,
    "showId" TEXT,
    "streamId" TEXT,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ViewEvent_kind_createdAt_idx" ON "ViewEvent"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "ViewEvent_showId_kind_idx" ON "ViewEvent"("showId", "kind");
