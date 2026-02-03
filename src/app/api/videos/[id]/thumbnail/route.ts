import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const video = await prisma.video.findUnique({
      where: { id },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (!video.outputPath) {
      return NextResponse.json({ error: 'Video not ready' }, { status: 400 });
    }

    // Thumbnail path is the same as video path but with .jpg extension
    const thumbnailPath = path.resolve(video.outputPath.replace('.mp4', '.jpg'));

    if (!existsSync(thumbnailPath)) {
      return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    }

    try {
      const imageBuffer = readFileSync(thumbnailPath);

      return new Response(imageBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': imageBuffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      return NextResponse.json({ error: 'Thumbnail file not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
