-- Existing streamers stay usable; new signups default to pending.
ALTER TABLE "Streamer" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "Streamer" ALTER COLUMN "status" SET DEFAULT 'pending';
