-- Migration: convert Canvas from per-user to room-based (entityType + entityId)
-- Old data is dropped (feature was new, no important data)

DROP TABLE IF EXISTS "Canvas";

CREATE TABLE "Canvas" (
  "id"         TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT NOT NULL,
  "snapshot"   JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Canvas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Canvas_entityType_entityId_key" ON "Canvas"("entityType", "entityId");
CREATE INDEX "Canvas_entityType_idx" ON "Canvas"("entityType");
