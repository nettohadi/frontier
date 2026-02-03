import { prisma } from '@/lib/prisma';
import { generateImagePrompts } from '@/lib/imagePrompts';
import type { Prisma } from '@prisma/client';

export async function processImagePrompts(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: { topicRelation: true },
  });

  if (!video.script) {
    throw new Error('Script not generated yet');
  }

  const topicName = video.topicRelation?.name || 'Unknown';
  console.log(`[${videoId}] Generating image prompts for topic: ${topicName}`);

  const prompts = await generateImagePrompts(video.script, topicName);

  console.log(`[${videoId}] Generated ${prompts.length} image prompts`);

  await prisma.video.update({
    where: { id: videoId },
    data: {
      imagePrompts: prompts as unknown as Prisma.InputJsonValue,
    },
  });
}
