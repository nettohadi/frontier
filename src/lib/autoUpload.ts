import { prisma } from './prisma';
import { PublerService, getPublerCredentials } from './publer';
import { getNextAvailableSlot, createScheduledAt, getDateForSchedule } from './scheduling';
import { processUpload } from '@/queues/processors/upload.processor';
import { Prisma } from '@prisma/client';

/**
 * Trigger auto-upload for a completed video
 * This is called by the render processor when a video finishes rendering
 * and has autoUpload enabled.
 *
 * Each upload is independent - failures don't affect other videos.
 */
export async function triggerAutoUpload(
  videoId: string,
  mode: 'immediate' | 'scheduled'
): Promise<void> {
  console.log(`[AutoUpload] Starting for video ${videoId}, mode: ${mode}`);

  try {
    // 1. Get the video
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new Error('Video not found');
    }

    if (!video.outputPath) {
      throw new Error('Video has no output file');
    }

    // Check if already has upload schedule (e.g., from regenerate)
    const existingSchedule = await prisma.uploadSchedule.findUnique({
      where: { videoId },
    });

    if (existingSchedule) {
      console.log(
        `[AutoUpload] Video ${videoId} already has upload schedule ${existingSchedule.id}, triggering upload`
      );
      // Update the schedule with video title/description if not set
      if (!existingSchedule.youtubeTitle || !existingSchedule.youtubeDescription) {
        await prisma.uploadSchedule.update({
          where: { id: existingSchedule.id },
          data: {
            youtubeTitle: existingSchedule.youtubeTitle || video.title,
            youtubeDescription: existingSchedule.youtubeDescription || video.description,
          },
        });
      }
      // Trigger the upload for the existing schedule
      await processUpload(existingSchedule.id);
      console.log(`[AutoUpload] Completed for video ${videoId} (existing schedule)`);
      return;
    }

    // 2. Get Publer settings
    const settings = await prisma.publerSettings.findUnique({
      where: { id: 'singleton' },
    });

    const credentials = getPublerCredentials(settings || undefined);
    if (!credentials) {
      throw new Error('Publer not configured. Set PUBLER_KEY and PUBLER_WORKSPACE_ID.');
    }

    if (!settings?.defaultChannelId) {
      throw new Error('No YouTube channel configured. Please set a default channel in Settings.');
    }

    // 3. Create upload schedule based on mode
    let scheduleId: string;

    if (mode === 'immediate') {
      // Immediate upload - schedule for now
      scheduleId = await createImmediateSchedule(
        videoId,
        settings.defaultChannelId,
        video.title,
        video.description
      );
    } else {
      // Scheduled upload - find next available slot
      scheduleId = await assignSlotWithRetry(
        videoId,
        settings.defaultChannelId,
        video.title,
        video.description
      );
    }

    console.log(`[AutoUpload] Created schedule ${scheduleId} for video ${videoId}`);

    // 4. Trigger the upload processor
    // For immediate uploads, this processes right away
    // For scheduled uploads, this also processes right away but with a future scheduled_at time for Publer
    await processUpload(scheduleId);

    console.log(`[AutoUpload] Completed for video ${videoId}`);
  } catch (error) {
    // Log error but don't throw - other videos continue independently
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[AutoUpload] Failed for video ${videoId}:`, errorMessage);

    // Update video with error status for UI display
    await prisma.video.update({
      where: { id: videoId },
      data: {
        uploadError: errorMessage,
        autoUpload: false, // Disable so user can retry manually
      },
    });
  }
}

/**
 * Create an immediate upload schedule (no specific time slot)
 */
async function createImmediateSchedule(
  videoId: string,
  channelId: string,
  title: string | null,
  description: string | null
): Promise<string> {
  const now = new Date();

  const schedule = await prisma.uploadSchedule.create({
    data: {
      videoId,
      youtubeChannelId: channelId,
      youtubeTitle: title,
      youtubeDescription: description,
      // Use current time for immediate upload
      scheduledSlot: -1, // Special value for immediate
      scheduledDate: now,
      scheduledAt: now,
      status: 'SCHEDULED',
    },
  });

  return schedule.id;
}

/**
 * Assign a slot with retry logic to handle race conditions
 * Uses database unique constraint to prevent duplicate slot assignments
 */
async function assignSlotWithRetry(
  videoId: string,
  channelId: string,
  title: string | null,
  description: string | null,
  maxRetries: number = 5
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get next available slot
      const slot = await getNextAvailableSlot();

      console.log(
        `[AutoUpload] Attempt ${attempt}: Trying slot ${slot.slot} on ${slot.displayTime}`
      );

      // Try to create schedule atomically
      const schedule = await prisma.uploadSchedule.create({
        data: {
          videoId,
          youtubeChannelId: channelId,
          youtubeTitle: title,
          youtubeDescription: description,
          scheduledSlot: slot.slot,
          scheduledDate: slot.date,
          scheduledAt: slot.scheduledAt,
          status: 'SCHEDULED',
        },
      });

      return schedule.id;
    } catch (error) {
      lastError = error as Error;

      // Check if it's a unique constraint violation (race condition)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        console.warn(`[AutoUpload] Slot taken (attempt ${attempt}), retrying...`);
        // Small delay before retry
        await sleep(100 * attempt);
        continue;
      }

      // For other errors, throw immediately
      throw error;
    }
  }

  throw lastError || new Error('Failed to assign slot after max retries');
}

/**
 * Get multiple upcoming slots for preview (used in GenerateModal)
 * Does not reserve them - just shows what slots would be used
 */
export async function previewUpcomingSlots(count: number): Promise<
  Array<{
    date: Date;
    slot: number;
    displayTime: string;
    scheduledAt: Date;
  }>
> {
  const slots: Array<{
    date: Date;
    slot: number;
    displayTime: string;
    scheduledAt: Date;
  }> = [];

  // Track which slots we've "used" in our preview
  const previewUsedSlots = new Map<string, Set<number>>();

  for (let i = 0; i < count; i++) {
    // Get next available slot, considering our preview
    const slot = await getNextAvailableSlotWithExclusions(previewUsedSlots);

    if (!slot) {
      break; // No more slots available
    }

    slots.push({
      date: slot.date,
      slot: slot.slot,
      displayTime: slot.displayTime,
      scheduledAt: slot.scheduledAt,
    });

    // Mark this slot as "used" for subsequent preview queries
    const dateKey = slot.date.toISOString();
    if (!previewUsedSlots.has(dateKey)) {
      previewUsedSlots.set(dateKey, new Set());
    }
    previewUsedSlots.get(dateKey)!.add(slot.slot);
  }

  return slots;
}

/**
 * Get next available slot, excluding already "previewed" slots
 */
async function getNextAvailableSlotWithExclusions(exclusions: Map<string, Set<number>>): Promise<{
  date: Date;
  slot: number;
  displayTime: string;
  scheduledAt: Date;
} | null> {
  const {
    getNowInTimezone,
    SCHEDULE_CONFIG,
    slotToHour,
    formatDateOnly,
    hourToSlot,
    getDateForSchedule,
    createScheduledAt,
  } = await import('./scheduling');
  const { startOfDay, addDays } = await import('date-fns');

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
    const dateKey = scheduledDate.toISOString();

    // Get existing schedules for this date
    const existingSchedules = await prisma.uploadSchedule.findMany({
      where: { scheduledDate },
      select: { scheduledSlot: true },
    });

    const usedSlots = new Set(existingSchedules.map((s) => s.scheduledSlot));

    // Add preview exclusions
    const previewExclusions = exclusions.get(dateKey) || new Set();

    // Determine starting slot
    let startSlot = 0;
    if (dayOffset === 0) {
      // For today, skip past slots
      const currentSlot = hourToSlot(currentHour + 1);
      startSlot = Math.max(0, currentSlot);
    }

    // Find first available slot
    for (let slot = startSlot; slot < SCHEDULE_CONFIG.slotsPerDay; slot++) {
      if (!usedSlots.has(slot) && !previewExclusions.has(slot)) {
        const hour = slotToHour(slot);
        const scheduledAt = createScheduledAt(targetDate, slot);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour;

        return {
          date: scheduledDate,
          slot,
          displayTime: `${formatDateOnly(scheduledAt)} at ${displayHour}:00 ${period} GMT+8`,
          scheduledAt,
        };
      }
    }
  }

  return null; // No available slots
}

/**
 * Validate that Publer is configured for auto-upload
 */
export async function validatePublerConfig(): Promise<{
  valid: boolean;
  error?: string;
}> {
  const settings = await prisma.publerSettings.findUnique({
    where: { id: 'singleton' },
  });

  const credentials = getPublerCredentials(settings || undefined);

  if (!credentials) {
    return {
      valid: false,
      error: 'Publer not configured. Please add API key and workspace ID in Settings.',
    };
  }

  if (!settings?.defaultChannelId) {
    return {
      valid: false,
      error: 'No YouTube channel selected. Please select a default channel in Settings.',
    };
  }

  // Test connection
  try {
    const publer = new PublerService(credentials.apiKey, credentials.workspaceId);
    const connected = await publer.testConnection();
    if (!connected) {
      return {
        valid: false,
        error: 'Could not connect to Publer. Please check your API credentials.',
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Failed to connect to Publer API.',
    };
  }

  return { valid: true };
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
