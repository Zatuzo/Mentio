-- Add user-canvas fields: name, ownerId, shareToken, make snapshot nullable
ALTER TABLE "Canvas"
  ADD COLUMN "name"       TEXT,
  ADD COLUMN "ownerId"    TEXT,
  ADD COLUMN "shareToken" TEXT;

-- snapshot was NOT NULL, make nullable so new canvases can start empty
ALTER TABLE "Canvas" ALTER COLUMN "snapshot" DROP NOT NULL;

-- Unique index on shareToken
CREATE UNIQUE INDEX "Canvas_shareToken_key" ON "Canvas"("shareToken");

-- Index on ownerId for fast list queries
CREATE INDEX "Canvas_ownerId_idx" ON "Canvas"("ownerId");

-- FK to user
ALTER TABLE "Canvas"
  ADD CONSTRAINT "Canvas_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
