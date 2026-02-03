import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import { startOfDay, addDays, setHours, setMinutes, setSeconds, isAfter } from 'date-fns';
import { prisma } from './prisma';

/**
 * Schedule configuration for YouTube uploads
 * All times are in GMT+8 (Asia/Singapore timezone)
 */
export const SCHEDULE_CONFIG = {
  timezone: 'Asia/Singapore', // GMT+8
  startHour: 10, // 10:00 AM
  endHour: 19, // 7:00 PM (last slot)
  slotsPerDay: 10, // 10:00, 11:00, ..., 19:00
} as const;

/**
 * Slot information
 */
export interface SlotInfo {
  slot: number;
  hour: number;
  time: string;
  scheduledAt: Date;
}

/**
 * Available slot result
 */
export interface AvailableSlot {
  date: Date;
  slot: number;
  hour: number;
  scheduledAt: Date;
  displayTime: string;
}

/**
 * Convert slot number to hour (GMT+8)
 */
export function slotToHour(slot: number): number {
  return SCHEDULE_CONFIG.startHour + slot;
}

/**
 * Convert hour to slot number
 */
export function hourToSlot(hour: number): number {
  return hour - SCHEDULE_CONFIG.startHour;
}

/**
 * Get all slot times for display
 */
export function getSlotTimes(): SlotInfo[] {
  const slots: SlotInfo[] = [];
  for (let slot = 0; slot < SCHEDULE_CONFIG.slotsPerDay; slot++) {
    const hour = slotToHour(slot);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    slots.push({
      slot,
      hour,
      time: `${displayHour}:00 ${period}`,
      scheduledAt: new Date(), // Placeholder, actual date will vary
    });
  }
  return slots;
}

/**
 * Format a date for display in GMT+8
 */
export function formatScheduleTime(utcDate: Date): string {
  const zoned = toZonedTime(utcDate, SCHEDULE_CONFIG.timezone);
  return format(zoned, 'MMM d, yyyy h:mm a', { timeZone: SCHEDULE_CONFIG.timezone });
}

/**
 * Format just the time portion in GMT+8
 */
export function formatTimeOnly(utcDate: Date): string {
  const zoned = toZonedTime(utcDate, SCHEDULE_CONFIG.timezone);
  return format(zoned, 'h:mm a', { timeZone: SCHEDULE_CONFIG.timezone });
}

/**
 * Format just the date portion in GMT+8
 */
export function formatDateOnly(utcDate: Date): string {
  const zoned = toZonedTime(utcDate, SCHEDULE_CONFIG.timezone);
  return format(zoned, 'MMM d, yyyy', { timeZone: SCHEDULE_CONFIG.timezone });
}

/**
 * Get the current time in GMT+8
 */
export function getNowInTimezone(): Date {
  return toZonedTime(new Date(), SCHEDULE_CONFIG.timezone);
}

/**
 * Convert a GMT+8 datetime to UTC for storage
 */
export function toUtc(gmt8Date: Date): Date {
  return fromZonedTime(gmt8Date, SCHEDULE_CONFIG.timezone);
}

/**
 * Create a scheduled datetime for a specific date and slot
 */
export function createScheduledAt(date: Date, slot: number): Date {
  const hour = slotToHour(slot);
  // Create the time in GMT+8
  let scheduled = setHours(date, hour);
  scheduled = setMinutes(scheduled, 0);
  scheduled = setSeconds(scheduled, 0);
  // Convert to UTC for storage
  return toUtc(scheduled);
}

/**
 * Get the start of day in GMT+8 timezone (normalized for database queries)
 */
export function getDateForSchedule(date: Date): Date {
  const zoned = toZonedTime(date, SCHEDULE_CONFIG.timezone);
  const dayStart = startOfDay(zoned);
  return toUtc(dayStart);
}

/**
 * Find the next available upload slot
 * Looks up to 30 days ahead to find an open slot
 */
export async function getNextAvailableSlot(): Promise<AvailableSlot> {
  const now = new Date();
  const nowInGMT8 = getNowInTimezone();
  const currentHour = nowInGMT8.getHours();

  // Start from today
  let checkDate = startOfDay(nowInGMT8);

  // If current time is past the last slot (19:00), start from tomorrow
  if (currentHour >= SCHEDULE_CONFIG.endHour) {
    checkDate = addDays(checkDate, 1);
  }

  // Look up to 30 days ahead
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const targetDate = addDays(checkDate, dayOffset);
    const scheduledDate = getDateForSchedule(targetDate);

    // Get existing schedules for this date (all statuses, since DB has unique constraint on date+slot)
    const existingSchedules = await prisma.uploadSchedule.findMany({
      where: { scheduledDate },
      select: { scheduledSlot: true },
    });

    const usedSlots = new Set(existingSchedules.map((s) => s.scheduledSlot));

    // Determine starting slot
    let startSlot = 0;
    if (dayOffset === 0) {
      // For today, skip past slots
      const currentSlot = hourToSlot(currentHour + 1);
      startSlot = Math.max(0, currentSlot);
    }

    // Find first available slot
    for (let slot = startSlot; slot < SCHEDULE_CONFIG.slotsPerDay; slot++) {
      if (!usedSlots.has(slot)) {
        const hour = slotToHour(slot);
        const scheduledAt = createScheduledAt(targetDate, slot);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour;

        return {
          date: scheduledDate,
          slot,
          hour,
          scheduledAt,
          displayTime: `${formatDateOnly(scheduledAt)} at ${displayHour}:00 ${period} GMT+8`,
        };
      }
    }
  }

  throw new Error('No available slots in the next 30 days');
}

/**
 * Get all slots for a specific date with their status
 */
export async function getSlotsForDate(date: Date): Promise<
  Array<{
    slot: number;
    hour: number;
    time: string;
    scheduledAt: Date;
    schedule: {
      id: string;
      videoId: string;
      status: string;
      youtubeTitle: string | null;
    } | null;
    available: boolean;
    isPast: boolean;
  }>
> {
  const scheduledDate = getDateForSchedule(date);
  const now = new Date();
  const nowInGMT8 = getNowInTimezone();
  const currentHour = nowInGMT8.getHours();
  const today = startOfDay(nowInGMT8);
  const targetDay = startOfDay(toZonedTime(date, SCHEDULE_CONFIG.timezone));
  const isToday = today.getTime() === targetDay.getTime();

  // Get all schedules for this date
  const schedules = await prisma.uploadSchedule.findMany({
    where: { scheduledDate },
    select: {
      id: true,
      videoId: true,
      scheduledSlot: true,
      status: true,
      youtubeTitle: true,
    },
  });

  const scheduleBySlot = new Map(schedules.map((s) => [s.scheduledSlot, s]));

  const slots = [];
  for (let slot = 0; slot < SCHEDULE_CONFIG.slotsPerDay; slot++) {
    const hour = slotToHour(slot);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    const schedule = scheduleBySlot.get(slot) || null;
    const scheduledAt = createScheduledAt(date, slot);

    // Check if slot is in the past
    const isPast = isToday && currentHour >= hour;

    slots.push({
      slot,
      hour,
      time: `${displayHour}:00 ${period}`,
      scheduledAt,
      schedule: schedule
        ? {
            id: schedule.id,
            videoId: schedule.videoId,
            status: schedule.status,
            youtubeTitle: schedule.youtubeTitle,
          }
        : null,
      available: !schedule && !isPast,
      isPast,
    });
  }

  return slots;
}

/**
 * Check if a specific slot is available
 */
export async function isSlotAvailable(date: Date, slot: number): Promise<boolean> {
  const scheduledDate = getDateForSchedule(date);

  const existing = await prisma.uploadSchedule.findUnique({
    where: {
      scheduledDate_scheduledSlot: {
        scheduledDate,
        scheduledSlot: slot,
      },
    },
  });

  if (existing) {
    return false;
  }

  // Also check if the slot is in the past
  const now = getNowInTimezone();
  const targetDay = startOfDay(toZonedTime(date, SCHEDULE_CONFIG.timezone));
  const today = startOfDay(now);
  const isToday = today.getTime() === targetDay.getTime();

  if (isToday) {
    const currentHour = now.getHours();
    const slotHour = slotToHour(slot);
    if (currentHour >= slotHour) {
      return false;
    }
  }

  return true;
}
