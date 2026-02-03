-- Rename Theme table to Topic
ALTER TABLE "Theme" RENAME TO "Topic";

-- Rename themeId column to topicId in Video table
ALTER TABLE "Video" RENAME COLUMN "themeId" TO "topicId";

-- Add new columns to Video table
ALTER TABLE "Video" ADD COLUMN "title" TEXT;
ALTER TABLE "Video" ADD COLUMN "description" TEXT;

-- Update foreign key constraint name (optional but cleaner)
ALTER TABLE "Video" DROP CONSTRAINT IF EXISTS "Video_themeId_fkey";
ALTER TABLE "Video" ADD CONSTRAINT "Video_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update index name on Topic table
ALTER INDEX IF EXISTS "Theme_name_key" RENAME TO "Topic_name_key";
ALTER INDEX IF EXISTS "Theme_isActive_lastUsedAt_idx" RENAME TO "Topic_isActive_lastUsedAt_idx";
ALTER INDEX IF EXISTS "Theme_pkey" RENAME TO "Topic_pkey";
