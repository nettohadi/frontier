import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addVideoJob } from '@/queues/queues';
import type { JobType } from '@/types';

const VALID_STEPS: JobType[] = [
  'generate-script',
  'generate-image-prompts',
  'generate-images',
  'generate-tts',
  'generate-srt',
  'render-video',
];

/**
 * POST /api/videos/[id]/retry
 * Retry a failed video from the step that failed.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Only failed videos can be retried' },
        { status: 400 }
      );
    }

    // Resume from the failed step, or restart from scratch if unknown
    const retryStep: JobType =
      video.failedStep && VALID_STEPS.includes(video.failedStep as JobType)
        ? (video.failedStep as JobType)
        : 'generate-script';

    // Reset status but keep all existing generated assets
    await prisma.video.update({
      where: { id },
      data: {
        status: 'PENDING',
        errorMessage: null,
        failedStep: null,
      },
    });

    await addVideoJob(id, retryStep);

    return NextResponse.json({
      success: true,
      message: `Retrying from step: ${retryStep}`,
      retryStep,
    });
  } catch (error) {
    console.error('Error retrying video:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to retry video', message }, { status: 500 });
  }
}
