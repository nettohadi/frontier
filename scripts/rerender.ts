/**
 * Re-render an existing video with subtitles
 * Usage: npx tsx scripts/rerender.ts <video-id>
 *
 * This script re-renders an existing video using its saved audio and alignment files,
 * allowing you to test subtitle burning without making new API calls.
 */

import { PrismaClient } from '@prisma/client';
import { renderVideo, getNextMusic } from '../src/lib/ffmpeg';
import { generateAssWithHighlight } from '../src/lib/srt';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { WordAlignment } from '../src/types';

const prisma = new PrismaClient();

async function rerender(videoId: string) {
  console.log(`\n=== Re-rendering video: ${videoId} ===\n`);

  // Fetch video from database
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { background: true },
  });

  if (!video) {
    console.error(`Video not found: ${videoId}`);
    process.exit(1);
  }

  const tempPath = process.env.TEMP_PATH || 'temp';

  console.log(`Topic: ${video.topic}`);
  console.log(`Status: ${video.status}`);
  console.log(`Audio: ${video.audioPath}`);
  console.log(`Background: ${video.background?.filename}`);

  // Validate required files exist
  if (!video.audioPath || !existsSync(video.audioPath)) {
    console.error(`Audio file not found: ${video.audioPath}`);
    process.exit(1);
  }

  // Check for alignment file to generate karaoke ASS
  const alignmentPath = path.join(tempPath, `${videoId}.alignment.json`);
  let subtitlePath: string;

  if (existsSync(alignmentPath)) {
    console.log(`\nGenerating karaoke-style ASS from alignment data...`);
    const alignmentData = await readFile(alignmentPath, 'utf-8');
    const alignment: WordAlignment = JSON.parse(alignmentData);
    subtitlePath = await generateAssWithHighlight(alignment, videoId, 4);
    console.log(`ASS generated: ${subtitlePath}`);
  } else if (video.srtPath && existsSync(video.srtPath)) {
    console.log(`Using existing subtitle file: ${video.srtPath}`);
    subtitlePath = video.srtPath;
  } else {
    console.error(`No alignment or subtitle file found for video`);
    process.exit(1);
  }

  if (!video.background?.filename) {
    console.error('No background video assigned');
    process.exit(1);
  }

  const backgroundPath = path.join(
    process.env.BACKGROUNDS_PATH || 'assets/backgrounds',
    video.background.filename
  );

  if (!existsSync(backgroundPath)) {
    console.error(`Background file not found: ${backgroundPath}`);
    process.exit(1);
  }

  // Create output directory
  const outputDir = process.env.OUTPUT_PATH || 'output';
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Output path with timestamp to avoid overwriting
  const timestamp = Date.now();
  const outputPath = path.join(outputDir, `${videoId}_rerender_${timestamp}.mp4`);

  console.log(`\nOutput: ${outputPath}`);
  console.log('\nStarting render with subtitles...\n');

  // Get next music
  const musicPath = await getNextMusic();
  if (musicPath) {
    console.log(`Music: ${musicPath}`);
  }

  try {
    await renderVideo({
      videoId,
      backgroundPath,
      audioPath: video.audioPath,
      srtPath: subtitlePath,
      outputPath,
      musicPath: musicPath || undefined,
      musicVolume: 0.25, // 25% volume for background music
      burnSubtitles: true,
    });

    console.log(`\n=== Render complete! ===`);
    console.log(`Output: ${outputPath}`);

    // Optionally update the database with new output path
    // await prisma.video.update({
    //   where: { id: videoId },
    //   data: { outputPath },
    // });
  } catch (error) {
    console.error('\nRender failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get video ID from command line
const videoId = process.argv[2];

if (!videoId) {
  console.log('Usage: npx tsx scripts/rerender.ts <video-id>');
  console.log('\nTo list available videos:');
  console.log('  npx tsx scripts/rerender.ts --list');
  process.exit(1);
}

if (videoId === '--list') {
  // List available videos
  prisma.video
    .findMany({
      where: {
        audioPath: { not: null },
        srtPath: { not: null },
      },
      select: {
        id: true,
        topic: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    .then((videos) => {
      console.log('\nAvailable videos for re-rendering:\n');
      videos.forEach((v) => {
        console.log(`  ${v.id}`);
        console.log(`    Topic: ${v.topic}`);
        console.log(`    Status: ${v.status}`);
        console.log(`    Created: ${v.createdAt.toLocaleString()}`);
        console.log('');
      });
    })
    .finally(() => prisma.$disconnect());
} else {
  rerender(videoId);
}
