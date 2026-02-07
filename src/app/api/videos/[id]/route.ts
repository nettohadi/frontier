import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// GET /api/videos/:id - Get video status
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        background: true,
        topicRelation: true,
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json(video);
  } catch (error) {
    console.error('Error fetching video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const UpdateVideoSchema = z.object({
  title: z.string().min(1).max(200),
});

// PATCH /api/videos/:id - Update video fields
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = UpdateVideoSchema.parse(body);

    const video = await prisma.video.update({
      where: { id },
      data: { title: data.title },
    });

    return NextResponse.json(video);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
