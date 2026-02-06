import { NextRequest, NextResponse } from 'next/server';
import { getSlotsForDate, formatDateOnly } from '@/lib/scheduling';

export const dynamic = 'force-dynamic';

// GET /api/upload/schedules/date?date=2026-02-03 - Get all slots for a specific date
export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    const date = new Date(dateParam);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const slots = await getSlotsForDate(date);

    return NextResponse.json({
      date: dateParam,
      displayDate: formatDateOnly(date),
      slots,
      availableCount: slots.filter((s) => s.available).length,
      scheduledCount: slots.filter((s) => s.schedule).length,
    });
  } catch (error) {
    console.error('Error getting slots for date:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
