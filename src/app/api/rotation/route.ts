import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listMusic } from '@/lib/ffmpeg';
import { listOverlays } from '@/lib/overlays';
import path from 'path';

// Color schemes count (hardcoded since it's in code)
const COLOR_SCHEMES_COUNT = 8;

// GET /api/rotation - Get current rotation status
export async function GET() {
  try {
    const counter = await prisma.rotationCounter.findUnique({
      where: { id: 'singleton' },
    });

    const musicFiles = listMusic();
    const overlayFiles = listOverlays();

    const musicIndex = counter ? counter.music % musicFiles.length : 0;
    const overlayIndex = counter ? counter.overlay % overlayFiles.length : 0;
    const colorSchemeIndex = counter ? counter.colorScheme % COLOR_SCHEMES_COUNT : 0;

    return NextResponse.json({
      counters: {
        music: counter?.music ?? 0,
        overlay: counter?.overlay ?? 0,
        colorScheme: counter?.colorScheme ?? 0,
      },
      current: {
        music: {
          index: musicIndex,
          total: musicFiles.length,
          nextFile: musicFiles[musicIndex] ? path.basename(musicFiles[musicIndex]) : null,
        },
        overlay: {
          index: overlayIndex,
          total: overlayFiles.length,
          nextFile: overlayFiles[overlayIndex] ? path.basename(overlayFiles[overlayIndex]) : null,
        },
        colorScheme: {
          index: colorSchemeIndex,
          total: COLOR_SCHEMES_COUNT,
        },
      },
      files: {
        music: musicFiles.map((f, i) => ({
          index: i,
          name: path.basename(f),
          isNext: i === musicIndex,
        })),
        overlays: overlayFiles.map((f, i) => ({
          index: i,
          name: path.basename(f),
          isNext: i === overlayIndex,
        })),
      },
    });
  } catch (error) {
    console.error('Error getting rotation status:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}

// POST /api/rotation - Reset counters
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reset } = body;

    if (reset === 'all') {
      // Reset all counters to 0
      await prisma.rotationCounter.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', music: 0, overlay: 0, colorScheme: 0 },
        update: { music: 0, overlay: 0, colorScheme: 0 },
      });
      return NextResponse.json({ message: 'All counters reset to 0' });
    }

    if (reset === 'music' || reset === 'overlay' || reset === 'colorScheme') {
      // Reset specific counter
      await prisma.rotationCounter.upsert({
        where: { id: 'singleton' },
        create: { id: 'singleton', music: 0, overlay: 0, colorScheme: 0 },
        update: { [reset]: 0 },
      });
      return NextResponse.json({ message: `${reset} counter reset to 0` });
    }

    return NextResponse.json(
      { error: 'Invalid reset value. Use: all, music, overlay, or colorScheme' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error resetting rotation:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
