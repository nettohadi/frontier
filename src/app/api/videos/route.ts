import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { addVideoJob } from '@/queues/queues';
import { VideoStatus, RenderMode } from '@prisma/client';

export const dynamic = 'force-dynamic';

const CreateVideoSchema = z.object({
  topic: z.string().min(3).max(500).optional().default('Auto theme rotation'),
  style: z.string().optional(),
  backgroundId: z.string().uuid().optional(),
  renderMode: z.nativeEnum(RenderMode).optional().default(RenderMode.BACKGROUND_VIDEO),
  // Auto-upload settings
  autoUpload: z.boolean().optional().default(false),
  uploadMode: z.enum(['immediate', 'scheduled']).nullable().optional(),
});

// POST /api/videos - Create a new video job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = CreateVideoSchema.parse(body);

    // If no background specified and using BACKGROUND_VIDEO mode, select next one in sequence
    let backgroundId = data.backgroundId;
    if (!backgroundId && data.renderMode === RenderMode.BACKGROUND_VIDEO) {
      const backgrounds = await prisma.backgroundVideo.findMany({
        orderBy: { createdAt: 'asc' },
      });
      if (backgrounds.length > 0) {
        // Count total videos to determine next background index
        const totalVideos = await prisma.video.count();
        const nextIndex = totalVideos % backgrounds.length;
        backgroundId = backgrounds[nextIndex].id;
      }
    }

    // Create video record
    const video = await prisma.video.create({
      data: {
        topic: data.topic,
        style: data.style,
        backgroundId,
        renderMode: data.renderMode,
        autoUpload: data.autoUpload,
        uploadMode: data.uploadMode,
      },
    });

    // Queue the first step
    await addVideoJob(video.id, 'generate-script');

    return NextResponse.json(
      {
        id: video.id,
        status: video.status,
        message: 'Video job queued',
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
    console.error('Error creating video:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}

// GET /api/videos - List videos with filtering
const ListVideosSchema = z.object({
  status: z.nativeEnum(VideoStatus).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { status, limit, offset } = ListVideosSchema.parse(searchParams);

    const where = status ? { status } : {};

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          background: true,
          topicRelation: true,
          uploadSchedule: {
            select: {
              id: true,
              status: true,
              scheduledAt: true,
              youtubeUrl: true,
              tiktokUrl: true,
              progress: true,
            },
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    return NextResponse.json({
      videos,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('Error listing videos:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
