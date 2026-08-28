-- CreateTable
CREATE TABLE "MessageQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "taskId" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "MessageQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageQueue_status_createdAt_idx" ON "MessageQueue"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MessageQueue_userId_idx" ON "MessageQueue"("userId");
