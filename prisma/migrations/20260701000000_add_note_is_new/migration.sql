ALTER TABLE "Note" ADD COLUMN "isNew" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Note_userId_isNew_idx" ON "Note"("userId", "isNew");
