import { prisma } from '@/lib/prisma';
import { generateSpeechWithTimestamps } from '@/lib/elevenlabs';

export async function processTts(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
  });

  if (!video.script) {
    throw new Error('Script not generated yet');
  }

  console.log(`[${videoId}] Generating TTS audio...`);

  const { audioPath, durationMs } = await generateSpeechWithTimestamps(video.script, videoId);

  console.log(`[${videoId}] Audio generated: ${audioPath} (${(durationMs / 1000).toFixed(1)}s)`);

  await prisma.video.update({
    where: { id: videoId },
    data: { audioPath, audioDurationMs: durationMs },
  });
}
