import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { addVideoJob } from '@/queues/queues';

const BatchCreateSchema = z.object({
  videos: z
    .array(
      z.object({
        topic: z.string().min(3).max(500),
        style: z.string().optional(),
        backgroundId: z.string().uuid().optional(),
      })
    )
    .min(1)
    .max(50), // Maximum 50 videos per batch
});

// POST /api/videos/batch - Create multiple video jobs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videos: videoInputs } = BatchCreateSchema.parse(body);

    // Get all backgrounds for sequential selection (round-robin)
    const backgrounds = await prisma.backgroundVideo.findMany({
      orderBy: { createdAt: 'asc' },
    });

    // Get current video count for sequential indexing
    const currentVideoCount = await prisma.video.count();

    // Create all video records with sequential backgrounds
    const createdVideos: Awaited<ReturnType<typeof prisma.video.create>>[] = [];
    for (let i = 0; i < videoInputs.length; i++) {
      const input = videoInputs[i];
      let backgroundId = input.backgroundId;

      if (!backgroundId && backgrounds.length > 0) {
        // Sequential selection: (currentCount + batchIndex) % totalBackgrounds
        const nextIndex = (currentVideoCount + i) % backgrounds.length;
        backgroundId = backgrounds[nextIndex].id;
      }

      const video = await prisma.video.create({
        data: {
          topic: input.topic,
          style: input.style,
          backgroundId,
        },
      });
      createdVideos.push(video);
    }

    // Queue all jobs
    await Promise.all(
      createdVideos.map((video) => addVideoJob(video.id, 'generate-script'))
    );

    return NextResponse.json(
      {
        created: createdVideos.length,
        videos: createdVideos.map((v) => ({
          id: v.id,
          topic: v.topic,
          status: v.status,
        })),
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
