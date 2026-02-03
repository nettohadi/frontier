import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { PublerService, getPublerCredentials } from '@/lib/publer';

// GET /api/settings/publer - Get Publer settings
export async function GET() {
  try {
    const settings = await prisma.publerSettings.findUnique({
      where: { id: 'singleton' },
    });

    const credentials = getPublerCredentials(settings || undefined);

    return NextResponse.json({
      apiKey: settings?.apiKey || null,
      workspaceId: settings?.workspaceId || null,
      defaultChannelId: settings?.defaultChannelId || null,
      configured: !!credentials,
    });
  } catch (error) {
    console.error('Error getting Publer settings:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}

const UpdateSettingsSchema = z.object({
  apiKey: z.string().optional(),
  workspaceId: z.string().optional(),
  defaultChannelId: z.string().optional(),
});

// PUT /api/settings/publer - Update Publer settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const data = UpdateSettingsSchema.parse(body);

    // Build update object only with provided fields
    const updateData: Record<string, unknown> = {};
    if (data.apiKey !== undefined) updateData.apiKey = data.apiKey;
    if (data.workspaceId !== undefined) updateData.workspaceId = data.workspaceId;
    if (data.defaultChannelId !== undefined) updateData.defaultChannelId = data.defaultChannelId;

    const settings = await prisma.publerSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({
      apiKey: settings.apiKey,
      workspaceId: settings.workspaceId,
      defaultChannelId: settings.defaultChannelId,
      configured: !!(settings.apiKey && settings.workspaceId),
      success: true,
    });
  } catch (error) {
    console.error('Error updating Publer settings:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}

// POST /api/settings/publer - Test connection
export async function POST() {
  try {
    const settings = await prisma.publerSettings.findUnique({
      where: { id: 'singleton' },
    });

    const credentials = getPublerCredentials(settings || undefined);

    if (!credentials) {
      return NextResponse.json(
        {
          error: 'Publer API key and workspace ID are required. Please configure them in Settings.',
        },
        { status: 400 }
      );
    }

    const publer = new PublerService(credentials.apiKey, credentials.workspaceId);
    const connected = await publer.testConnection();

    if (connected) {
      return NextResponse.json({
        success: true,
        message: 'Connection successful',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Connection failed. Check your API key and workspace ID.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error testing Publer connection:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Connection test failed', message }, { status: 500 });
  }
}
