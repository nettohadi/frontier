import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatScheduleTime } from '@/lib/scheduling';

// GET /api/upload/status/[scheduleId] - Get real-time upload status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  try {
    const { scheduleId } = await params;

    const schedule = await prisma.uploadSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            topic: true,
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: schedule.id,
      videoId: schedule.videoId,
      videoTitle: schedule.video.title || schedule.video.topic,
      status: schedule.status,
      progress: schedule.progress,
      youtubeUrl: schedule.youtubeUrl,
      errorMessage: schedule.errorMessage,
      scheduledAt: schedule.scheduledAt.toISOString(),
      displayTime: formatScheduleTime(schedule.scheduledAt),
      completedAt: schedule.completedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('Error getting upload status:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
