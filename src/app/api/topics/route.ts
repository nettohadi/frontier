import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// GET /api/topics - List all topics
export async function GET() {
  try {
    const topics = await prisma.topic.findMany({
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' },
      ],
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });

    return NextResponse.json({ topics });
  } catch (error) {
    console.error('Error listing topics:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}

// POST /api/topics - Create a new topic
const CreateTopicSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(1000),
  isActive: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = CreateTopicSchema.parse(body);

    // Check if topic with same name exists
    const existing = await prisma.topic.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Topic with this name already exists' },
        { status: 400 }
      );
    }

    const topic = await prisma.topic.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
      },
    });

    return NextResponse.json(topic, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating topic:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}
