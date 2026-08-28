-- Add imageUrls to Mention
ALTER TABLE "Mention" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT '{}';
