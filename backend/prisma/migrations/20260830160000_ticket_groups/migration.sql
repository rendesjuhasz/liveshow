ALTER TABLE "Payment" ALTER COLUMN "ticketId" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "packPurchaseId" TEXT;

CREATE TABLE IF NOT EXISTS "TicketPackPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "ticketCount" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "unitValue" INTEGER NOT NULL,
    "remainingCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketPackPurchase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TicketPackPurchase_userId_idx" ON "TicketPackPurchase"("userId", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "TicketSpend" (
    "id" TEXT NOT NULL,
    "viewerUserId" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "showId" TEXT,
    "purchaseId" TEXT,
    "ticketGroup" TEXT NOT NULL,
    "ticketsSpent" INTEGER NOT NULL,
    "ticketUnitValue" INTEGER NOT NULL,
    "calculatedAmount" INTEGER NOT NULL,
    "questionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketSpend_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TicketSpend_streamerId_idx" ON "TicketSpend"("streamerId", "createdAt");
CREATE INDEX IF NOT EXISTS "TicketSpend_viewerUserId_idx" ON "TicketSpend"("viewerUserId", "createdAt");
