import { prisma } from '@/lib/prisma';
import { generateScript } from '@/lib/scriptGen';
import { getNextTopic } from '@/lib/topics';
import { validateScript, shouldRegenerateScript } from '@/lib/scriptValidation';
import type { Topic } from '@prisma/client';

const MAX_REGENERATION_ATTEMPTS = 2;

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

  let attempts = 0;
  let title: string = '';
  let description: string = '';
  let script: string = '';
  let wordCount: number = 0;
  let validationResult;

  // Generation loop with validation
  while (attempts < MAX_REGENERATION_ATTEMPTS) {
    attempts++;
    console.log(
      `[${videoId}] Generating script (attempt ${attempts}/${MAX_REGENERATION_ATTEMPTS})`
    );

    const generated = await generateScript({
      theme: theme as Topic,
    });

    title = generated.title;
    description = generated.description;
    script = generated.script;
    wordCount = generated.wordCount;

    console.log(`[${videoId}] Script generated: "${title}" with ${wordCount} words`);

    // Update status to validating
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'VALIDATING_SCRIPT' },
    });

    // Validate the generated script
    console.log(`[${videoId}] Validating script quality...`);
    const validation = await validateScript(title, description, script);

    if (!validation.success) {
      console.error(`[${videoId}] Validation failed to run, accepting script anyway`);
      validationResult = validation.result;
      break;
    }

    validationResult = validation.result;

    console.log(`[${videoId}] Validation result:`, {
      isValid: validationResult.isValid,
      quality: validationResult.overallQuality,
      issueCount: validationResult.issues.length,
      recommendation: validationResult.recommendation,
    });

    // Check if we should regenerate
    if (shouldRegenerateScript(validationResult, MAX_REGENERATION_ATTEMPTS, attempts)) {
      console.log(
        `[${videoId}] Script has issues, regenerating (attempt ${attempts}/${MAX_REGENERATION_ATTEMPTS})`
      );
      // Set status back to generating script for next attempt
      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'GENERATING_SCRIPT' },
      });
      continue;
    }

    // Script is acceptable
    console.log(`[${videoId}] Script validation passed`);
    break;
  }

  // Save script and validation results
  await prisma.video.update({
    where: { id: videoId },
    data: {
      title,
      description,
      script,
      scriptWordCount: wordCount,
      topicId,
      scriptValidationResult: validationResult as any,
      validationPassed: validationResult?.isValid ?? false,
      validationAttempts: attempts,
    },
  });

  console.log(
    `[${videoId}] Script saved with validation (passed: ${validationResult?.isValid}, attempts: ${attempts})`
  );
}
