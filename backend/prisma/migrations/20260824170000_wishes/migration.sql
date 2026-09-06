-- CreateTable
CREATE TABLE "wishes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "streamer_id" TEXT,
    "text" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "wishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "wish_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "wishes_created_at_idx" ON "wishes"("created_at");
CREATE INDEX "wishes_status_idx" ON "wishes"("status");
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");
CREATE UNIQUE INDEX "user_badges_wish_id_key" ON "user_badges"("wish_id");

ALTER TABLE "wishes" ADD CONSTRAINT "wishes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_streamer_id_fkey" FOREIGN KEY ("streamer_id") REFERENCES "Streamer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
