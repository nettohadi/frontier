import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// GET /api/themes/:id - Get a single theme
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const theme = await prisma.theme.findUnique({
      where: { id },
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });

    if (!theme) {
      return NextResponse.json(
        { error: 'Theme not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(theme);
  } catch (error) {
    console.error('Error getting theme:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}

// PUT /api/themes/:id - Update a theme
const UpdateThemeSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().min(10).max(1000).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = UpdateThemeSchema.parse(body);

    // Check if theme exists
    const existing = await prisma.theme.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Theme not found' },
        { status: 404 }
      );
    }

    // If name is being changed, check for duplicates
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.theme.findUnique({
        where: { name: data.name },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Theme with this name already exists' },
          { status: 400 }
        );
      }
    }

    const theme = await prisma.theme.update({
      where: { id },
      data,
    });

    return NextResponse.json(theme);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating theme:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}

// DELETE /api/themes/:id - Delete a theme
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if theme exists and has videos
    const theme = await prisma.theme.findUnique({
      where: { id },
      include: {
        _count: {
          select: { videos: true },
        },
      },
    });

    if (!theme) {
      return NextResponse.json(
        { error: 'Theme not found' },
        { status: 404 }
      );
    }

    if (theme._count.videos > 0) {
      return NextResponse.json(
        { error: 'Cannot delete theme with associated videos. Deactivate it instead.' },
        { status: 400 }
      );
    }

    await prisma.theme.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting theme:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}
