import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { addVideoJob } from '@/queues/queues';
import { RenderMode } from '@prisma/client';

const BatchCreateSchema = z.object({
  count: z.coerce.number().min(1).max(10), // 1-10 videos per batch
  renderMode: z.nativeEnum(RenderMode).optional().default(RenderMode.AI_IMAGES),
  // Auto-upload settings
  autoUpload: z.boolean().optional().default(false),
  uploadMode: z.enum(['immediate', 'scheduled']).nullable().optional(),
});

// POST /api/videos/batch - Create multiple video jobs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { count, renderMode, autoUpload, uploadMode } = BatchCreateSchema.parse(body);

    // Get all backgrounds for sequential selection (for BACKGROUND_VIDEO mode)
    const backgrounds = await prisma.backgroundVideo.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Get current video count for sequential indexing
    const currentVideoCount = await prisma.video.count();

    // Create all video records
    const createdVideos: Awaited<ReturnType<typeof prisma.video.create>>[] = [];
    for (let i = 0; i < count; i++) {
      let backgroundId: string | undefined = undefined;

      if (renderMode === RenderMode.BACKGROUND_VIDEO && backgrounds.length > 0) {
        // Sequential selection: (currentCount + batchIndex) % totalBackgrounds
        const nextIndex = (currentVideoCount + i) % backgrounds.length;
        backgroundId = backgrounds[nextIndex].id;
      }

      const video = await prisma.video.create({
        data: {
          topic: 'Auto theme rotation', // Use topic rotation
          renderMode,
          backgroundId,
          autoUpload,
          uploadMode,
        },
      });
      createdVideos.push(video);
    }

    // Queue all jobs
    await Promise.all(createdVideos.map((video) => addVideoJob(video.id, 'generate-script')));

    return NextResponse.json(
      {
        created: createdVideos.length,
        videos: createdVideos.map((v) => ({
          id: v.id,
          topic: v.topic,
          status: v.status,
          autoUpload: v.autoUpload,
          uploadMode: v.uploadMode,
        })),
        message: `${count} video${count > 1 ? 's' : ''} queued for generation`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating batch:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
