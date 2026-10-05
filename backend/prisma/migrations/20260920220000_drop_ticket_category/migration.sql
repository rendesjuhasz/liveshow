-- Phase E: retire leftover show-ticket categories. Packs and video follows stay.

UPDATE "Ticket" SET "categoryId" = NULL WHERE "categoryId" IS NOT NULL;

ALTER TABLE "Ticket" DROP CONSTRAINT IF EXISTS "Ticket_categoryId_fkey";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "categoryId";

DROP TABLE IF EXISTS "ShowTicketOffer";
DROP TABLE IF EXISTS "TicketCategory";

ALTER TABLE "GiftCampaign" DROP COLUMN IF EXISTS "categoryKey";
