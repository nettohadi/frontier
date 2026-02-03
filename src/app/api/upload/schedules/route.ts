import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSlotsForDate, getNextAvailableSlot, formatScheduleTime } from '@/lib/scheduling';
import { UploadStatus } from '@prisma/client';

const ListSchedulesSchema = z.object({
  status: z.nativeEnum(UploadStatus).optional(),
  date: z.string().optional(), // ISO date string
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// GET /api/upload/schedules - List all upload schedules
export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { status, date, limit, offset } = ListSchedulesSchema.parse(searchParams);

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    if (date) {
      // Get schedules for a specific date
      const targetDate = new Date(date);
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);
      where.scheduledAt = {
        gte: dayStart,
        lte: dayEnd,
      };
    }

    const [schedules, total] = await Promise.all([
      prisma.uploadSchedule.findMany({
        where,
        include: {
          video: {
            select: {
              id: true,
              title: true,
              topic: true,
              outputPath: true,
              topicRelation: { select: { name: true } },
            },
          },
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.uploadSchedule.count({ where }),
    ]);

    // Add formatted time to each schedule
    const schedulesWithDisplay = schedules.map((s) => ({
      ...s,
      displayTime: formatScheduleTime(s.scheduledAt),
    }));

    // Also get next available slot info
    let nextAvailable = null;
    try {
      nextAvailable = await getNextAvailableSlot();
    } catch {
      // No slots available
    }

    return NextResponse.json({
      schedules: schedulesWithDisplay,
      pagination: { total, limit, offset },
      nextAvailable,
    });
  } catch (error) {
    console.error('Error listing schedules:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
