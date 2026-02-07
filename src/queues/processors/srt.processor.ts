import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { generateASSFromElevenLabs } from '@/lib/elevenlabs-to-ass';
import type { WordAlignment } from '@/types';

export async function processSrt(videoId: string): Promise<void> {
  const tempPath = process.env.TEMP_PATH || 'temp';

  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
  });

  if (!video.audioPath) {
    throw new Error('Audio not generated yet');
  }

  console.log(`[${videoId}] Generating Sufi karaoke ASS subtitles...`);

  // Load alignment data from previous step
  const alignmentPath = path.join(tempPath, `${videoId}.alignment.json`);
  const alignmentData = await readFile(alignmentPath, 'utf-8');
  const alignment: WordAlignment = JSON.parse(alignmentData);

  // Generate ASS with Sufi karaoke \kf fill effect
  const assContent = generateASSFromElevenLabs(alignment, { wordsPerLine: 6 });
  const assPath = path.join(tempPath, `${videoId}.ass`);
  await writeFile(assPath, assContent, 'utf-8');

  console.log(`[${videoId}] ASS generated: ${assPath}`);

  await prisma.video.update({
    where: { id: videoId },
    data: { srtPath: assPath },
  });
}
