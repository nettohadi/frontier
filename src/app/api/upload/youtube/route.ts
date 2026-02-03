import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getPublerCredentials } from '@/lib/publer';
import { processUpload } from '@/queues/processors/upload.processor';

const ScheduleUploadSchema = z.object({
  videoId: z.string().uuid(),
  channelId: z.string().optional(),
});

// POST /api/upload/youtube - Schedule a video for YouTube upload
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, channelId } = ScheduleUploadSchema.parse(body);

    // Check if video exists and is completed
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { uploadSchedule: true },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Video must be completed before uploading' },
        { status: 400 }
      );
    }

    if (!video.outputPath) {
      return NextResponse.json({ error: 'Video has no output file' }, { status: 400 });
    }

    // Handle existing upload schedule
    if (video.uploadSchedule) {
      const existingSchedule = video.uploadSchedule;

      // If completed, don't allow re-upload
      if (existingSchedule.status === 'COMPLETED') {
        return NextResponse.json(
          {
            error: 'Video has already been uploaded',
            scheduleId: existingSchedule.id,
            youtubeUrl: existingSchedule.youtubeUrl,
          },
          { status: 400 }
        );
      }

      // If currently uploading, don't allow duplicate
      if (existingSchedule.status === 'UPLOADING') {
        return NextResponse.json(
          {
            error: 'Upload is already in progress',
            scheduleId: existingSchedule.id,
            progress: existingSchedule.progress,
          },
          { status: 400 }
        );
      }

      // If failed or scheduled, delete the old schedule to allow retry
      await prisma.uploadSchedule.delete({
        where: { id: existingSchedule.id },
      });
      console.log(
        `[Upload] Deleted previous ${existingSchedule.status} schedule for retry: ${existingSchedule.id}`
      );
    }

    // Get Publer settings for channel
    const settings = await prisma.publerSettings.findUnique({
      where: { id: 'singleton' },
    });

    // Check if Publer credentials are configured (env vars or database)
    const credentials = getPublerCredentials(settings || undefined);
    if (!credentials) {
      return NextResponse.json(
        {
          error:
            'Publer not configured. Set PUBLER_KEY and PUBLER_WORKSPACE_ID in .env or configure in Settings.',
        },
        { status: 400 }
      );
    }

    const youtubeChannelId = channelId || settings?.defaultChannelId;
    if (!youtubeChannelId) {
      return NextResponse.json(
        { error: 'No YouTube channel selected. Please select a channel in Settings.' },
        { status: 400 }
      );
    }

    // Create the upload schedule (immediate upload, no scheduling)
    const now = new Date();
    const schedule = await prisma.uploadSchedule.create({
      data: {
        videoId,
        youtubeChannelId,
        youtubeTitle: video.title || `Video ${video.id.slice(0, 8)}`,
        youtubeDescription: video.description || '',
        scheduledSlot: 0, // Not used for immediate upload
        scheduledDate: now,
        scheduledAt: now,
        status: 'UPLOADING',
        progress: 0,
      },
    });

    // Start the upload process immediately in the background
    processUpload(schedule.id).catch((error) => {
      console.error(`[Upload] Background upload failed for ${schedule.id}:`, error);
    });

    return NextResponse.json(
      {
        scheduleId: schedule.id,
        message: 'Upload started',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error scheduling YouTube upload:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
