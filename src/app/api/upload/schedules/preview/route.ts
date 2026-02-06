import { NextRequest, NextResponse } from 'next/server';
import { previewUpcomingSlots } from '@/lib/autoUpload';

export const dynamic = 'force-dynamic';

/**
 * GET /api/upload/schedules/preview?count=5
 * Returns the next N available upload slots without reserving them
 * Used by GenerateModal to show which slots would be used for scheduled uploads
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const count = Math.min(Math.max(1, parseInt(searchParams.get('count') || '1')), 10);

    const slots = await previewUpcomingSlots(count);

    // Check if we have enough slots
    const hasEnoughSlots = slots.length >= count;
    const availableCount = slots.length;

    return NextResponse.json({
      slots,
      requested: count,
      available: availableCount,
      hasEnoughSlots,
      message: hasEnoughSlots
        ? undefined
        : `Only ${availableCount} slot${availableCount !== 1 ? 's' : ''} available in the next 30 days`,
    });
  } catch (error) {
    console.error('Error previewing slots:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to preview slots', message }, { status: 500 });
  }
}
