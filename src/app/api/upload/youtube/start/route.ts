import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { processUpload } from '@/queues/processors/upload.processor';

const StartUploadSchema = z.object({
  scheduleId: z.string().uuid(),
});

// POST /api/upload/youtube/start - Start uploading a scheduled video
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scheduleId } = StartUploadSchema.parse(body);

    // Get the schedule
    const schedule = await prisma.uploadSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    if (schedule.status === 'UPLOADING') {
      return NextResponse.json({ error: 'Upload is already in progress' }, { status: 400 });
    }

    if (schedule.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Upload has already completed', youtubeUrl: schedule.youtubeUrl },
        { status: 400 }
      );
    }

    // Start the upload process in the background
    // We don't await this - it runs asynchronously
    processUpload(scheduleId).catch((error) => {
      console.error(`[Upload] Background upload failed for ${scheduleId}:`, error);
    });

    return NextResponse.json({
      message: 'Upload started',
      scheduleId,
      status: 'UPLOADING',
    });
  } catch (error) {
    console.error('Error starting upload:', error);
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
