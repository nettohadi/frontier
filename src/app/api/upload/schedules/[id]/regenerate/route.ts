import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addVideoJob } from '@/queues/queues';
import { RenderMode } from '@prisma/client';
import { createPublerServiceFromEnv } from '@/lib/publer';

// POST /api/upload/schedules/[id]/regenerate - Regenerate a video for this schedule slot
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get the existing schedule
    const existingSchedule = await prisma.uploadSchedule.findUnique({
      where: { id },
      include: {
        video: true,
      },
    });

    if (!existingSchedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Store the schedule slot info before deleting
    const { scheduledDate, scheduledSlot, scheduledAt, youtubeChannelId, tiktokChannelId, publerJobId } =
      existingSchedule;

    // Get Publer settings for YouTube channel
    const publerSettings = await prisma.publerSettings.findUnique({
      where: { id: 'singleton' },
    });

    const channelId = youtubeChannelId || publerSettings?.defaultChannelId;

    const tikTokId = tiktokChannelId || publerSettings?.defaultTikTokChannelId || null;

    if (!channelId && !tikTokId) {
      return NextResponse.json({ error: 'No upload channel configured' }, { status: 400 });
    }

    // Cancel the Publer scheduled post if it exists
    if (publerJobId && publerSettings) {
      const publerService = await createPublerServiceFromEnv({
        apiKey: publerSettings.apiKey,
        workspaceId: publerSettings.workspaceId,
      });

      if (publerService) {
        console.log(`[Regenerate] Deleting Publer post: ${publerJobId}`);
        const deleted = await publerService.deletePost(publerJobId);
        if (deleted) {
          console.log(`[Regenerate] Cancelled Publer schedule: ${publerJobId}`);
          // Wait for Publer to process the deletion (required 1 min gap between posts)
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          // If deletion failed and the old schedule was COMPLETED, warn but continue
          // The new upload might fail with a time conflict, but we'll handle that separately
          console.warn(`[Regenerate] Failed to cancel Publer schedule: ${publerJobId}`);
        }
      }
    }

    // Delete the old schedule (this frees up the slot)
    await prisma.uploadSchedule.delete({
      where: { id },
    });

    // Create a new video
    const newVideo = await prisma.video.create({
      data: {
        topic: 'Auto theme rotation',
        renderMode: RenderMode.AI_IMAGES,
        autoUpload: true,
        uploadMode: 'scheduled',
      },
    });

    // Create the new upload schedule for the same slot
    const newSchedule = await prisma.uploadSchedule.create({
      data: {
        videoId: newVideo.id,
        scheduledDate,
        scheduledSlot,
        scheduledAt,
        youtubeChannelId: channelId || '',
        tiktokChannelId: tikTokId,
        status: 'SCHEDULED',
      },
    });

    // Queue the video generation job
    await addVideoJob(newVideo.id, 'generate-script');

    return NextResponse.json({
      success: true,
      message: 'Video regeneration started',
      video: {
        id: newVideo.id,
        status: newVideo.status,
      },
      schedule: {
        id: newSchedule.id,
        scheduledAt: newSchedule.scheduledAt,
      },
    });
  } catch (error) {
    console.error('Error regenerating schedule:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
