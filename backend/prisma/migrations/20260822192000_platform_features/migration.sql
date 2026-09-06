-- Stream extra columns
ALTER TABLE "Stream" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Stream" ADD COLUMN IF NOT EXISTS "streamKey" TEXT;
ALTER TABLE "Stream" ADD COLUMN IF NOT EXISTS "hlsPath" TEXT;
ALTER TABLE "Stream" ADD COLUMN IF NOT EXISTS "rtpPort" INTEGER;
ALTER TABLE "Stream" ADD COLUMN IF NOT EXISTS "showId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Stream_streamKey_key" ON "Stream"("streamKey");
CREATE UNIQUE INDEX IF NOT EXISTS "Stream_showId_key" ON "Stream"("showId");

DO $$ BEGIN
  ALTER TABLE "Stream" ADD CONSTRAINT "Stream_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Recording <-> Show
ALTER TABLE "Recording" ADD COLUMN IF NOT EXISTS "showId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Recording" ADD CONSTRAINT "Recording_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Archive: Show-based (replace Stream relation)
ALTER TABLE "Archive" DROP CONSTRAINT IF EXISTS "Archive_showId_fkey";
DROP TABLE IF EXISTS "Archive";

CREATE TABLE "Archive" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "publicPath" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Archive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Archive_showId_key" ON "Archive"("showId");
ALTER TABLE "Archive" ADD CONSTRAINT "Archive_showId_fkey"
  FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Show.streamerId
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "streamerId" TEXT;

-- Streamer
CREATE TABLE IF NOT EXISTS "Streamer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "bio" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Streamer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Streamer_email_key" ON "Streamer"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Streamer_userId_key" ON "Streamer"("userId");
DO $$ BEGIN
  ALTER TABLE "Streamer" ADD CONSTRAINT "Streamer_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Show" ADD CONSTRAINT "Show_streamerId_fkey"
    FOREIGN KEY ("streamerId") REFERENCES "Streamer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ticket default pending for new rows; keep existing paid
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'pending';

-- Payment
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'dev',
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_stripeSessionId_key" ON "Payment"("stripeSessionId");
DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payout
CREATE TABLE IF NOT EXISTS "Payout" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Payout" ADD CONSTRAINT "Payout_streamerId_fkey"
    FOREIGN KEY ("streamerId") REFERENCES "Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Question
CREATE TABLE IF NOT EXISTS "Question" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "Question" ADD CONSTRAINT "Question_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Question" ADD CONSTRAINT "Question_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ChatMessage
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
