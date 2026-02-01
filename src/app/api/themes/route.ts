import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// GET /api/themes - List all themes
export async function GET() {
  try {
    const themes = await prisma.theme.findMany({
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

    return NextResponse.json({ themes });
  } catch (error) {
    console.error('Error listing themes:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}

// POST /api/themes - Create a new theme
const CreateThemeSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(1000),
  isActive: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = CreateThemeSchema.parse(body);

    // Check if theme with same name exists
    const existing = await prisma.theme.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Theme with this name already exists' },
        { status: 400 }
      );
    }

    const theme = await prisma.theme.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
      },
    });

    return NextResponse.json(theme, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating theme:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}
