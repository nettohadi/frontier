import { prisma } from '@/lib/prisma';
import { generateImages } from '@/lib/fal';
import type { ImagePromptData } from '@/types';

export async function processImages(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
  });

  if (!video.imagePrompts) {
    throw new Error('Image prompts not generated yet');
  }

  const prompts = video.imagePrompts as unknown as ImagePromptData[];
  console.log(`[${videoId}] Generating ${prompts.length} images with Fal.ai`);

  // Extract just the prompt strings
  const promptStrings = prompts.map((p) => p.prompt);

  // Generate all images
  const results = await generateImages(promptStrings, videoId);

  // Extract local paths
  const imagePaths = results.map((r) => r.localPath);

  console.log(`[${videoId}] Generated ${imagePaths.length} images`);

  await prisma.video.update({
    where: { id: videoId },
    data: {
      imagePaths,
    },
  });
}
