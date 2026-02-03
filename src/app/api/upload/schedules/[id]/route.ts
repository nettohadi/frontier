import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatScheduleTime } from '@/lib/scheduling';

// GET /api/upload/schedules/[id] - Get a specific schedule
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const schedule = await prisma.uploadSchedule.findUnique({
      where: { id },
      include: {
        video: {
          select: {
            id: true,
            title: true,
            topic: true,
            outputPath: true,
            topicRelation: { select: { name: true } },
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...schedule,
      displayTime: formatScheduleTime(schedule.scheduledAt),
    });
  } catch (error) {
    console.error('Error getting schedule:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}

// DELETE /api/upload/schedules/[id] - Cancel a scheduled upload
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const schedule = await prisma.uploadSchedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Can't cancel if already uploading or completed
    if (schedule.status === 'UPLOADING') {
      return NextResponse.json(
        { error: 'Cannot cancel an upload that is in progress' },
        { status: 400 }
      );
    }

    if (schedule.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Cannot cancel a completed upload' }, { status: 400 });
    }

    // Delete the schedule
    await prisma.uploadSchedule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Schedule cancelled' });
  } catch (error) {
    console.error('Error cancelling schedule:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
