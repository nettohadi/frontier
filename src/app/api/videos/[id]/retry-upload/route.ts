import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { triggerAutoUpload } from '@/lib/autoUpload';

/**
 * POST /api/videos/[id]/retry-upload
 * Retry a failed auto-upload for a video
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get the video
    const video = await prisma.video.findUnique({
      where: { id },
      include: { uploadSchedule: true },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Video is not ready for upload' }, { status: 400 });
    }

    if (!video.outputPath) {
      return NextResponse.json({ error: 'Video has no output file' }, { status: 400 });
    }

    // Check if there's an existing upload schedule that's not failed
    if (video.uploadSchedule && video.uploadSchedule.status !== 'FAILED') {
      return NextResponse.json(
        {
          error: 'Video already has an active upload schedule',
          status: video.uploadSchedule.status,
        },
        { status: 400 }
      );
    }

    // Delete any existing failed upload schedule
    if (video.uploadSchedule) {
      await prisma.uploadSchedule.delete({
        where: { id: video.uploadSchedule.id },
      });
    }

    // Clear error and re-enable auto-upload
    await prisma.video.update({
      where: { id },
      data: {
        uploadError: null,
        autoUpload: true,
        uploadMode: video.uploadMode || 'immediate',
      },
    });

    // Trigger the upload
    const uploadMode = (video.uploadMode as 'immediate' | 'scheduled') || 'immediate';
    await triggerAutoUpload(id, uploadMode);

    return NextResponse.json({
      success: true,
      message: 'Upload retry triggered',
    });
  } catch (error) {
    console.error('Error retrying upload:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to retry upload', message }, { status: 500 });
  }
}
