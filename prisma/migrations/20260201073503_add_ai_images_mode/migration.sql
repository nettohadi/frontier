-- CreateEnum
CREATE TYPE "RenderMode" AS ENUM ('BACKGROUND_VIDEO', 'AI_IMAGES');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VideoStatus" ADD VALUE 'GENERATING_IMAGE_PROMPTS';
ALTER TYPE "VideoStatus" ADD VALUE 'GENERATING_IMAGES';

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "imagePaths" TEXT[],
ADD COLUMN     "imagePrompts" JSONB,
ADD COLUMN     "overlayPath" TEXT,
ADD COLUMN     "renderMode" "RenderMode" NOT NULL DEFAULT 'BACKGROUND_VIDEO';
