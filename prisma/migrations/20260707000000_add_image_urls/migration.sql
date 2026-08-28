-- Add imageUrls to Task
ALTER TABLE "Task" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT '{}';

-- Add imageUrls to Note
ALTER TABLE "Note" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT '{}';
