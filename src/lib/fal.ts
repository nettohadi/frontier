import { fal } from '@fal-ai/client';
import { writeFile } from 'fs/promises';
import path from 'path';

// Configure Fal.ai client
fal.config({
  credentials: process.env.FAL_KEY,
});

export interface GenerateImageResult {
  url: string;
  localPath: string;
}

/**
 * Generate an image using Fal.ai Flux Schnell model
 * Resolution: 1080x1920 (vertical 9:16)
 */
export async function generateImage(
  prompt: string,
  videoId: string,
  imageIndex: number
): Promise<GenerateImageResult> {
  const tempPath = process.env.TEMP_PATH || 'temp';

  console.log(`[Fal.ai] Generating image ${imageIndex + 1} for ${videoId}`);

  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: {
        width: 1080,
        height: 1920,
      },
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: false,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS') {
        console.log(`[Fal.ai] Image ${imageIndex + 1} in progress...`);
      }
    },
  });

  const imageUrl = result.data.images[0].url;
  console.log(`[Fal.ai] Image ${imageIndex + 1} generated: ${imageUrl}`);

  // Download the image
  const localPath = path.join(tempPath, `${videoId}_image_${imageIndex}.png`);
  await downloadImage(imageUrl, localPath);

  return { url: imageUrl, localPath };
}

/**
 * Download an image from URL to local path
 */
export async function downloadImage(
  url: string,
  outputPath: string
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await writeFile(outputPath, Buffer.from(buffer));
  console.log(`[Fal.ai] Downloaded image to: ${outputPath}`);
}

/**
 * Generate multiple images for a video
 */
export async function generateImages(
  prompts: string[],
  videoId: string
): Promise<GenerateImageResult[]> {
  const results: GenerateImageResult[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const result = await generateImage(prompts[i], videoId, i);
    results.push(result);
  }

  return results;
}
