CREATE TABLE IF NOT EXISTS "GiftCampaign" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    "showId" TEXT NOT NULL REFERENCES "Show"(id) ON DELETE CASCADE,
    "categoryKey" TEXT NOT NULL DEFAULT 'nezo',
    "maxClaims" INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "GiftClaim" (
    id TEXT PRIMARY KEY,
    "campaignId" TEXT REFERENCES "GiftCampaign"(id) ON DELETE SET NULL,
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "ticketId" TEXT NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "GiftClaim_campaign_user"
ON "GiftClaim" ("campaignId", "userId")
WHERE "campaignId" IS NOT NULL;
