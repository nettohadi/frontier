import { prisma } from '@/lib/prisma';
import { generateScript } from '@/lib/scriptGen';
import { getNextTopic } from '@/lib/topics';
import type { Topic } from '@prisma/client';

export async function processScript(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
  });

  let theme: Topic | { id: null; name: string; description: string };
  let topicId: string | null = null;

  // Check if video has a custom topic (one-off generation)
  if (video.customTopicName && video.customTopicDescription) {
    theme = {
      id: null,
      name: video.customTopicName,
      description: video.customTopicDescription,
    };
    console.log(`[${videoId}] Using custom topic: "${theme.name}"`);
  } else {
    // Get next topic using round-robin rotation
    const rotatedTopic = await getNextTopic();
    theme = rotatedTopic;
    topicId = rotatedTopic.id;
    console.log(`[${videoId}] Selected topic from rotation: "${theme.name}"`);
  }

  console.log(`[${videoId}] Generating Hakikat script for topic: "${theme.name}"`);

  const { title, description, script, wordCount } = await generateScript({
    theme: theme as Topic,
  });

  console.log(`[${videoId}] Script generated: "${title}" with ${wordCount} words`);

  await prisma.video.update({
    where: { id: videoId },
    data: {
      title,
      description,
      script,
      scriptWordCount: wordCount,
      topicId,
    },
  });
}
