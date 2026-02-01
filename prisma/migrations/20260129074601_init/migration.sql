-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'GENERATING_SCRIPT', 'GENERATING_AUDIO', 'GENERATING_SRT', 'RENDERING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "style" TEXT DEFAULT 'educational',
    "script" TEXT,
    "scriptWordCount" INTEGER,
    "audioPath" TEXT,
    "srtPath" TEXT,
    "outputPath" TEXT,
    "status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "backgroundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "currentJobId" TEXT,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundVideo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackgroundVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Video_status_idx" ON "Video"("status");

-- CreateIndex
CREATE INDEX "Video_createdAt_idx" ON "Video"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundVideo_filename_key" ON "BackgroundVideo"("filename");

-- CreateIndex
CREATE INDEX "BackgroundVideo_category_idx" ON "BackgroundVideo"("category");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_backgroundId_fkey" FOREIGN KEY ("backgroundId") REFERENCES "BackgroundVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
