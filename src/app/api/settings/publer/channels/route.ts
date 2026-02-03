import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PublerService, getPublerCredentials } from '@/lib/publer';

// GET /api/settings/publer/channels - Get YouTube channels from Publer
export async function GET() {
  try {
    const settings = await prisma.publerSettings.findUnique({
      where: { id: 'singleton' },
    });

    // Use env vars with database fallback
    const credentials = getPublerCredentials(settings || undefined);

    if (!credentials) {
      return NextResponse.json(
        { error: 'Publer not configured. Please add your API Key and Workspace ID in Settings.' },
        { status: 400 }
      );
    }

    const publer = new PublerService(credentials.apiKey, credentials.workspaceId);
    const channels = await publer.getYouTubeChannels();

    return NextResponse.json({ channels });
  } catch (error) {
    console.error('Error fetching YouTube channels:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to fetch channels', message }, { status: 500 });
  }
}
