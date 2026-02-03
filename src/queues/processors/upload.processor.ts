import { prisma } from '@/lib/prisma';
import { PublerService, getPublerCredentials } from '@/lib/publer';

/**
 * Process a YouTube upload via Publer
 * This runs when an upload is triggered (either manually or at scheduled time)
 */
export async function processUpload(scheduleId: string): Promise<void> {
  console.log(`[Upload] Starting upload for schedule: ${scheduleId}`);

  // Get the schedule with video
  const schedule = await prisma.uploadSchedule.findUniqueOrThrow({
    where: { id: scheduleId },
    include: { video: true },
  });

  if (!schedule.video.outputPath) {
    throw new Error('Video has no output file');
  }

  // Get Publer settings (env vars take priority over database)
  const settings = await prisma.publerSettings.findUnique({
    where: { id: 'singleton' },
  });

  const credentials = getPublerCredentials(settings || undefined);
  if (!credentials) {
    throw new Error('Publer not configured. Set PUBLER_KEY and PUBLER_WORKSPACE_ID in .env');
  }

  const publer = new PublerService(credentials.apiKey, credentials.workspaceId);

  // Update status to uploading
  await updateProgress(scheduleId, 'UPLOADING', 5);
  console.log(`[Upload] ${scheduleId}: Starting media upload`);

  try {
    // Step 1: Upload video media (0-40%)
    const mediaId = await publer.uploadMedia(schedule.video.outputPath);
    await updateProgress(scheduleId, 'UPLOADING', 40);
    console.log(`[Upload] ${scheduleId}: Video uploaded, ID: ${mediaId}`);

    // Step 2: Create YouTube Short post (40-60%)
    const { jobId } = await publer.createYouTubeShort({
      accountId: schedule.youtubeChannelId,
      mediaIds: [mediaId],
      title: schedule.youtubeTitle || schedule.video.title || 'Untitled Video',
      description:
        schedule.youtubeDescription || schedule.video.description || '',
      scheduleAt: schedule.scheduledAt,
      isShort: true,
    });

    await prisma.uploadSchedule.update({
      where: { id: scheduleId },
      data: { publerJobId: jobId, progress: 60 },
    });
    console.log(`[Upload] ${scheduleId}: Post created, job ID: ${jobId}`);

    // Wait a moment for Publer to process, then check job status
    await sleep(3000);
    const jobStatus = await publer.getJobStatus(jobId);
    console.log(`[Upload] ${scheduleId}: Job status:`, JSON.stringify(jobStatus));

    // Check for failures in the job
    if (jobStatus.status === 'failed' || jobStatus.error) {
      throw new Error(jobStatus.error || 'Post creation failed on Publer');
    }

    // Check if draft mode
    const isDraftMode = process.env.PUBLER_DRAFT_MODE === 'true';

    if (isDraftMode) {
      // For drafts, verify the job completed successfully
      if (jobStatus.status === 'completed' || jobStatus.status === 'pending') {
        await prisma.uploadSchedule.update({
          where: { id: scheduleId },
          data: {
            status: 'COMPLETED',
            progress: 100,
            completedAt: new Date(),
          },
        });

        await prisma.video.update({
          where: { id: schedule.videoId },
          data: { uploadedToYouTube: true },
        });

        console.log(`[Upload] ${scheduleId}: Draft saved to Publer successfully!`);
        return;
      }
    }

    // Step 3: Poll for completion (60-100%) - only for scheduled/published posts
    const maxAttempts = 60; // 5 minutes with 5s intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      await sleep(5000); // Wait 5 seconds between polls
      attempts++;

      const status = await publer.getJobStatus(jobId);
      console.log(`[Upload] ${scheduleId}: Poll ${attempts}/${maxAttempts}, status: ${status.status}`);

      if (status.status === 'completed') {
        // Success!
        await prisma.uploadSchedule.update({
          where: { id: scheduleId },
          data: {
            status: 'COMPLETED',
            progress: 100,
            youtubeUrl: status.result?.url || null,
            completedAt: new Date(),
          },
        });

        await prisma.video.update({
          where: { id: schedule.videoId },
          data: { uploadedToYouTube: true },
        });

        console.log(`[Upload] ${scheduleId}: Completed! URL: ${status.result?.url}`);
        return;
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Upload failed on Publer');
      }

      // Update progress (60-95 range during polling)
      const pollProgress = 60 + Math.min(35, attempts * 1);
      await updateProgress(scheduleId, 'UPLOADING', pollProgress);
    }

    // Timeout
    throw new Error('Upload timed out after 5 minutes');
  } catch (error) {
    // Mark as failed
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.uploadSchedule.update({
      where: { id: scheduleId },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });
    console.error(`[Upload] ${scheduleId}: Failed - ${errorMessage}`);
    throw error;
  }
}

/**
 * Update upload progress
 */
async function updateProgress(
  scheduleId: string,
  status: 'SCHEDULED' | 'UPLOADING' | 'COMPLETED' | 'FAILED',
  progress: number
): Promise<void> {
  await prisma.uploadSchedule.update({
    where: { id: scheduleId },
    data: { status, progress },
  });
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
