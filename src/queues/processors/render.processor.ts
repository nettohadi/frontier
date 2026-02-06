import { unlink } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { RenderMode } from '@prisma/client';
import { renderVideo, renderImageBasedVideo, getNextMusic, extractThumbnail } from '@/lib/ffmpeg';
import { getNextOverlay } from '@/lib/overlays';
import { cleanupOldVideos } from '@/lib/cleanup';

export async function processRender(videoId: string): Promise<void> {
  const assetsPath = process.env.ASSETS_PATH || 'assets/backgrounds';
  const outputPath = process.env.OUTPUT_PATH || 'output';
  const tempPath = process.env.TEMP_PATH || 'temp';

  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: { background: true },
  });

  if (!video.audioPath || !video.srtPath) {
    throw new Error('Missing audio or SRT file');
  }

  // Get next background music using sequential rotation (if available)
  const musicPath = await getNextMusic();
  if (musicPath) {
    console.log(`[${videoId}] Using background music: ${path.basename(musicPath)}`);
  }

  const finalOutputPath = path.join(outputPath, `${videoId}.mp4`);

  // Route to correct render function based on mode
  if (video.renderMode === RenderMode.AI_IMAGES) {
    await renderWithAiImages(video, finalOutputPath, musicPath, tempPath);
  } else {
    await renderWithBackgroundVideo(video, finalOutputPath, assetsPath, musicPath);
  }

  console.log(`[${videoId}] Video rendered: ${finalOutputPath}`);

  // Generate thumbnail
  const thumbnailPath = finalOutputPath.replace('.mp4', '.jpg');
  try {
    await extractThumbnail(finalOutputPath, thumbnailPath, 1);
    console.log(`[${videoId}] Thumbnail generated: ${thumbnailPath}`);
  } catch (err) {
    console.error(`[${videoId}] Failed to generate thumbnail:`, err);
    // Continue even if thumbnail fails - it's not critical
  }

  // Update database
  await prisma.video.update({
    where: { id: videoId },
    data: { outputPath: finalOutputPath },
  });

  // Cleanup temp files
  await cleanup(videoId, tempPath, video.renderMode, video.imagePaths);

  // Cleanup old videos if we have more than 50
  const deletedCount = await cleanupOldVideos();
  if (deletedCount > 0) {
    console.log(`[Cleanup] Removed ${deletedCount} old videos`);
  }
}

async function renderWithBackgroundVideo(
  video: {
    id: string;
    audioPath: string | null;
    srtPath: string | null;
    audioDurationMs: number | null;
    background: { name: string; filename: string } | null;
  },
  finalOutputPath: string,
  assetsPath: string,
  musicPath: string | null
): Promise<void> {
  if (!video.background) {
    throw new Error('No background video assigned');
  }

  console.log(`[${video.id}] Rendering video with background: ${video.background.name}`);

  const backgroundPath = path.join(assetsPath, video.background.filename);

  await renderVideo({
    videoId: video.id,
    backgroundPath,
    audioPath: video.audioPath!,
    srtPath: video.srtPath!,
    outputPath: finalOutputPath,
    musicPath: musicPath || undefined,
    musicVolume: 0.25,
    burnSubtitles: true,
    audioDurationSec: video.audioDurationMs ? video.audioDurationMs / 1000 : undefined,
  });
}

async function renderWithAiImages(
  video: { id: string; audioPath: string | null; srtPath: string | null; audioDurationMs: number | null; imagePaths: string[] },
  finalOutputPath: string,
  musicPath: string | null,
  tempPath: string
): Promise<void> {
  if (!video.imagePaths || video.imagePaths.length === 0) {
    throw new Error('No AI images generated');
  }

  console.log(`[${video.id}] Rendering video with ${video.imagePaths.length} AI images`);

  // Get an overlay (optional)
  const overlayPath = await getNextOverlay();
  if (overlayPath) {
    console.log(`[${video.id}] Using overlay: ${path.basename(overlayPath)}`);
  }

  await renderImageBasedVideo({
    videoId: video.id,
    imagePaths: video.imagePaths,
    audioPath: video.audioPath!,
    srtPath: video.srtPath!,
    outputPath: finalOutputPath,
    overlayPath: overlayPath || undefined,
    musicPath: musicPath || undefined,
    musicVolume: 0.25,
    enableKenBurns: false, // Static image - no zoom/pan
    enableLightRays: false, // Using overlay only
    musicOnlyEndingSec: 3, // 3 seconds of music-only at the end
    audioDurationSec: video.audioDurationMs ? video.audioDurationMs / 1000 : undefined,
  });
}

async function cleanup(
  videoId: string,
  tempPath: string,
  renderMode: RenderMode,
  imagePaths?: string[]
): Promise<void> {
  const tempFiles = [
    path.join(tempPath, `${videoId}.mp3`),
    path.join(tempPath, `${videoId}.srt`),
    path.join(tempPath, `${videoId}.ass`),
    path.join(tempPath, `${videoId}.alignment.json`),
  ];

  // Add image files if in AI_IMAGES mode
  if (renderMode === RenderMode.AI_IMAGES && imagePaths) {
    tempFiles.push(...imagePaths);
  }

  for (const file of tempFiles) {
    try {
      await unlink(file);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  console.log(`[${videoId}] Temp files cleaned up`);
}
