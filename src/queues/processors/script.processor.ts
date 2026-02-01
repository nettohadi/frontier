import { prisma } from '@/lib/prisma';
import { generateScript } from '@/lib/scriptGen';
import { getNextTheme } from '@/lib/themes';

export async function processScript(videoId: string): Promise<void> {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: videoId },
  });

  // Get next theme using round-robin rotation
  const theme = await getNextTheme();
  console.log(`[${videoId}] Selected theme: "${theme.name}"`);

  console.log(`[${videoId}] Generating Hakikat script for theme: "${theme.name}"`);

  const { script, wordCount } = await generateScript({ theme });

  console.log(`[${videoId}] Script generated: ${wordCount} words`);

  await prisma.video.update({
    where: { id: videoId },
    data: {
      script,
      scriptWordCount: wordCount,
      themeId: theme.id,
    },
  });
}
