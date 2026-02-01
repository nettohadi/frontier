import { prisma } from '@/lib/prisma';
import { generateImagePrompts } from '@/lib/imagePrompts';
import type { Prisma } from '@prisma/client';

export async function processImagePrompts(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
    include: { theme: true },
  });

  if (!video.script) {
    throw new Error('Script not generated yet');
  }

  const themeName = video.theme?.name || 'Unknown';
  console.log(`[${videoId}] Generating image prompts for theme: ${themeName}`);

  const prompts = await generateImagePrompts(video.script, themeName);

  console.log(`[${videoId}] Generated ${prompts.length} image prompts`);

  await prisma.video.update({
    where: { id: videoId },
    data: {
      imagePrompts: prompts as unknown as Prisma.InputJsonValue,
    },
  });
}
