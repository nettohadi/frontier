import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { generateAssWithHighlight } from '@/lib/srt';
import type { WordAlignment } from '@/types';

export async function processSrt(videoId: string): Promise<void> {
  const tempPath = process.env.TEMP_PATH || 'temp';

  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
  });

  if (!video.audioPath) {
    throw new Error('Audio not generated yet');
  }

  console.log(`[${videoId}] Generating ASS subtitles with karaoke highlight...`);

  // Load alignment data from previous step
  const alignmentPath = path.join(tempPath, `${videoId}.alignment.json`);
  const alignmentData = await readFile(alignmentPath, 'utf-8');
  const alignment: WordAlignment = JSON.parse(alignmentData);

  // Generate ASS with word-by-word highlighting (karaoke style)
  const assPath = await generateAssWithHighlight(alignment, videoId, 4);

  console.log(`[${videoId}] ASS generated: ${assPath}`);

  await prisma.video.update({
    where: { id: videoId },
    data: { srtPath: assPath }, // Store ASS path in srtPath field
  });
}
