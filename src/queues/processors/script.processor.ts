import { prisma } from '@/lib/prisma';
import { generateScript } from '@/lib/scriptGen';
import { getNextTopic } from '@/lib/topics';

export async function processScript(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
  });

  // Get next topic using round-robin rotation
  const theme = await getNextTopic();
  console.log(`[${videoId}] Selected topic: "${theme.name}"`);

  console.log(`[${videoId}] Generating Hakikat script for topic: "${theme.name}"`);

  const { title, description, script, wordCount } = await generateScript({ theme });

  console.log(`[${videoId}] Script generated: "${title}" with ${wordCount} words`);

  await prisma.video.update({
    where: { id: videoId },
    data: {
      title,
      description,
      script,
      scriptWordCount: wordCount,
      topicId: theme.id,
    },
  });
}
