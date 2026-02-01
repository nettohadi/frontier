import { Queue } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';
import type { JobType, VideoJobData } from '@/types';

// Lazy initialization to avoid connection during build/SSR
let videoQueue: Queue<VideoJobData> | null = null;

function getQueue(): Queue<VideoJobData> {
  if (!videoQueue) {
    const connection = createRedisConnection();
    videoQueue = new Queue<VideoJobData>('video-processing', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });
  }
  return videoQueue;
}

export async function addVideoJob(videoId: string, step: JobType): Promise<void> {
  const queue = getQueue();
  await queue.add(step, { videoId, step });
}

export { getQueue as getVideoQueue };
