-- Maintenance events and audit log
CREATE TABLE IF NOT EXISTS "MaintenanceEvent" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "services" TEXT NOT NULL DEFAULT '[]',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "notify24Sent" BOOLEAN NOT NULL DEFAULT false,
    "notify1Sent" BOOLEAN NOT NULL DEFAULT false,
    "notify10Sent" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "MaintenanceLog" (
    "id" TEXT PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "services" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MaintenanceEvent_status_starts" ON "MaintenanceEvent" ("status", "startsAt");
CREATE INDEX IF NOT EXISTS "MaintenanceLog_eventId" ON "MaintenanceLog" ("eventId");
