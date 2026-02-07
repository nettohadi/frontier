import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const DEFAULT_MODEL = 'google/gemini-2.5-flash';

// GET /api/settings/generation
export async function GET() {
  try {
    const settings = await prisma.generationSettings.findUnique({
      where: { id: 'singleton' },
    });

    return NextResponse.json({
      scriptModel: settings?.scriptModel || DEFAULT_MODEL,
    });
  } catch (error) {
    console.error('Error getting generation settings:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}

const UpdateSchema = z.object({
  scriptModel: z.string().min(1),
});

// PUT /api/settings/generation
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { scriptModel } = UpdateSchema.parse(body);

    await prisma.generationSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', scriptModel },
      update: { scriptModel },
    });

    return NextResponse.json({ success: true, scriptModel });
  } catch (error) {
    console.error('Error updating generation settings:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
