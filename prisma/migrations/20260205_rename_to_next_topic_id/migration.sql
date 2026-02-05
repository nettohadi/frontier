-- Rename lastTopicId to nextTopicId
ALTER TABLE "RotationCounter" RENAME COLUMN "lastTopicId" TO "nextTopicId";
