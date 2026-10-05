CREATE UNIQUE INDEX IF NOT EXISTS "GiftClaim_first_buyers_user"
ON "GiftClaim" ("userId")
WHERE source = 'first_buyers';
