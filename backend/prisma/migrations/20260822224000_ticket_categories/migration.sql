-- CreateTable
CREATE TABLE IF NOT EXISTS "TicketCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TicketCategory_key_key" ON "TicketCategory"("key");

INSERT INTO "TicketCategory" ("id", "key", "name", "price", "sortOrder")
SELECT gen_random_uuid(), 'nezo', 'Néző jegy', 2000, 1
WHERE NOT EXISTS (SELECT 1 FROM "TicketCategory" WHERE "key" = 'nezo');

INSERT INTO "TicketCategory" ("id", "key", "name", "price", "sortOrder")
SELECT gen_random_uuid(), 'interaktiv', 'Interaktív jegy', 4000, 2
WHERE NOT EXISTS (SELECT 1 FROM "TicketCategory" WHERE "key" = 'interaktiv');

INSERT INTO "TicketCategory" ("id", "key", "name", "price", "sortOrder")
SELECT gen_random_uuid(), 'vip', 'VIP jegy', 8000, 3
WHERE NOT EXISTS (SELECT 1 FROM "TicketCategory" WHERE "key" = 'vip');

CREATE TABLE IF NOT EXISTS "ShowTicketOffer" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ShowTicketOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShowTicketOffer_showId_categoryId_key" ON "ShowTicketOffer"("showId", "categoryId");

DO $$ BEGIN
  ALTER TABLE "ShowTicketOffer" ADD CONSTRAINT "ShowTicketOffer_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ShowTicketOffer" ADD CONSTRAINT "ShowTicketOffer_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "ShowTicketOffer" ("id", "showId", "categoryId")
SELECT gen_random_uuid(), s."id", c."id"
FROM "Show" s
CROSS JOIN "TicketCategory" c
WHERE c."key" = 'nezo'
  AND NOT EXISTS (
    SELECT 1 FROM "ShowTicketOffer" o WHERE o."showId" = s."id" AND o."categoryId" = c."id"
  );

UPDATE "Ticket" t
SET "categoryId" = c."id"
FROM "TicketCategory" c
WHERE c."key" = 'nezo' AND t."categoryId" IS NULL;
