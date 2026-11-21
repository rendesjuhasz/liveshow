CREATE TABLE IF NOT EXISTS "ShowFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "ShowFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShowFavorite_userId_showId_key" ON "ShowFavorite"("userId", "showId");
CREATE INDEX IF NOT EXISTS "ShowFavorite_userId_createdAt_idx" ON "ShowFavorite"("userId", "createdAt");
