import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { VideoStatus, RenderMode } from '@prisma/client';
import type { JobType, VideoJobData } from '@/types';
import { processScript } from './processors/script.processor';
import { processImagePrompts } from './processors/imagePrompts.processor';
import { processImages } from './processors/images.processor';
import { processTts } from './processors/tts.processor';
import { processSrt } from './processors/srt.processor';
import { processRender } from './processors/render.processor';
import { addVideoJob } from './queues';
import { triggerAutoUpload } from '@/lib/autoUpload';

const connection = createRedisConnection();

const statusMap: Record<JobType, VideoStatus> = {
  'generate-script': VideoStatus.GENERATING_SCRIPT,
  'generate-image-prompts': VideoStatus.GENERATING_IMAGE_PROMPTS,
  'generate-images': VideoStatus.GENERATING_IMAGES,
  'generate-tts': VideoStatus.GENERATING_AUDIO,
  'generate-srt': VideoStatus.GENERATING_SRT,
  'render-video': VideoStatus.RENDERING,
};

// Pipeline for BACKGROUND_VIDEO mode (existing)
const backgroundVideoPipeline: Record<JobType, JobType | null> = {
  'generate-script': 'generate-tts',
  'generate-image-prompts': 'generate-images', // Not used in this mode
  'generate-images': 'generate-tts', // Not used in this mode
  'generate-tts': 'generate-srt',
  'generate-srt': 'render-video',
  'render-video': null,
};

// Pipeline for AI_IMAGES mode (new)
const aiImagesPipeline: Record<JobType, JobType | null> = {
  'generate-script': 'generate-image-prompts',
  'generate-image-prompts': 'generate-images',
  'generate-images': 'generate-tts',
  'generate-tts': 'generate-srt',
  'generate-srt': 'render-video',
  'render-video': null,
};

function getNextStep(step: JobType, renderMode: RenderMode): JobType | null {
  if (renderMode === RenderMode.AI_IMAGES) {
    return aiImagesPipeline[step];
  }
  return backgroundVideoPipeline[step];
}

export const videoWorker = new Worker<VideoJobData>(
  'video-processing',
  async (job: Job<VideoJobData>) => {
    const { videoId, step } = job.data;

    console.log(`[${videoId}] Starting step: ${step}`);

    // Update status
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: statusMap[step],
        currentJobId: job.id,
      },
    });

    // Process based on step
    switch (step) {
      case 'generate-script':
        await processScript(videoId);
        break;
      case 'generate-image-prompts':
        await processImagePrompts(videoId);
        break;
      case 'generate-images':
        await processImages(videoId);
        break;
      case 'generate-tts':
        await processTts(videoId);
        break;
      case 'generate-srt':
        await processSrt(videoId);
        break;
      case 'render-video':
        await processRender(videoId);
        break;
    }

    // Get video to check render mode for pipeline routing
    const video = await prisma.video.findUniqueOrThrow({
      where: { id: videoId },
    });

    // Queue next step or mark complete
    const next = getNextStep(step, video.renderMode);
    if (next) {
      console.log(`[${videoId}] Queueing next step: ${next}`);
      await addVideoJob(videoId, next);
    } else {
      console.log(`[${videoId}] Pipeline complete!`);
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: VideoStatus.COMPLETED,
          completedAt: new Date(),
          errorMessage: null,
        },
      });

      // Trigger auto-upload if enabled
      if (video.autoUpload && video.uploadMode) {
        console.log(`[${videoId}] Triggering auto-upload (mode: ${video.uploadMode})`);
        // Run async - don't await to avoid blocking the worker
        triggerAutoUpload(videoId, video.uploadMode as 'immediate' | 'scheduled')
          .catch((err) => console.error(`[${videoId}] Auto-upload error:`, err));
      }
    }
  },
  {
    connection,
    concurrency: 2, // Process 2 jobs at a time
    limiter: {
      max: 10,
      duration: 60000, // 10 jobs per minute
    },
  }
);

// Error handling
videoWorker.on('failed', async (job, err) => {
  if (job) {
    console.error(`[${job.data.videoId}] Job failed:`, err.message);
    await prisma.video.update({
      where: { id: job.data.videoId },
      data: {
        status: VideoStatus.FAILED,
        errorMessage: err.message,
        retryCount: { increment: 1 },
      },
    });
  }
});

videoWorker.on('completed', (job) => {
  console.log(`[${job.data.videoId}] Step ${job.data.step} completed`);
});
