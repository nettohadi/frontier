import { unlink } from 'fs/promises';
import { prisma } from './prisma';

const MAX_VIDEOS = 50;

/**
 * Clean up old completed videos when count exceeds MAX_VIDEOS.
 * Deletes both files (mp4 + jpg thumbnail) and database records.
 */
export async function cleanupOldVideos(): Promise<number> {
  const completedCount = await prisma.video.count({
    where: { status: 'COMPLETED' },
  });

  if (completedCount <= MAX_VIDEOS) return 0;

  const toDeleteCount = completedCount - MAX_VIDEOS;

  // Delete oldest completed videos (regardless of upload status)
  const videosToDelete = await prisma.video.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { createdAt: 'asc' },
    take: toDeleteCount,
  });

  for (const video of videosToDelete) {
    // Delete files
    if (video.outputPath) {
      try {
        await unlink(video.outputPath);
      } catch {
        // Ignore if file doesn't exist
      }
      try {
        await unlink(video.outputPath.replace('.mp4', '.jpg'));
      } catch {
        // Ignore if thumbnail doesn't exist
      }
    }

    // Delete from DB (cascade will handle related records)
    await prisma.video.delete({ where: { id: video.id } });
    console.log(`[Cleanup] Deleted old video: ${video.id}`);
  }

  return videosToDelete.length;
}
