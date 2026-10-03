CREATE UNIQUE INDEX IF NOT EXISTS "GiftClaim_first_users_user"
ON "GiftClaim" ("userId")
WHERE source = 'first_users';
