-- Add lmsSourceId to Task
ALTER TABLE "Task" ADD COLUMN "lmsSourceId" TEXT;

-- Create LmsConnection model
CREATE TABLE "LmsConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "icalUrl" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'moodle',
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LmsConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LmsConnection_userId_key" ON "LmsConnection"("userId");
CREATE INDEX "LmsConnection_userId_idx" ON "LmsConnection"("userId");

ALTER TABLE "LmsConnection" ADD CONSTRAINT "LmsConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
