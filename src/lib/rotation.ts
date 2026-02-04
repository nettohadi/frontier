import { prisma } from './prisma';

type RotationType = 'music' | 'overlay' | 'colorScheme' | 'openingHook' | 'topic';

// Ensure rotation counter exists and get next index for a given type
// Counter stores "the next index to use" - we read it, use it, then increment
async function getNextIndex(type: RotationType, totalItems: number): Promise<number> {
  if (totalItems === 0) return -1;

  // Use transaction to atomically read-then-increment
  const index = await prisma.$transaction(async (tx) => {
    // Ensure counter exists
    const counter = await tx.rotationCounter.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', music: 0, overlay: 0, colorScheme: 0, openingHook: 0, topic: 0 },
      update: {}, // No update needed, just ensure it exists
    });

    // Get current value and calculate index
    const currentValue = counter[type];
    const currentIndex = currentValue % totalItems;

    // Increment for next time
    await tx.rotationCounter.update({
      where: { id: 'singleton' },
      data: { [type]: currentValue + 1 },
    });

    return currentIndex;
  });

  return index;
}

// Get next music index
export async function getNextMusicIndex(totalItems: number): Promise<number> {
  return getNextIndex('music', totalItems);
}

// Get next overlay index
export async function getNextOverlayIndex(totalItems: number): Promise<number> {
  return getNextIndex('overlay', totalItems);
}

// Get next color scheme index
export async function getNextColorSchemeIndex(totalItems: number): Promise<number> {
  return getNextIndex('colorScheme', totalItems);
}

// Get next opening hook index
export async function getNextOpeningHookIndex(totalItems: number): Promise<number> {
  return getNextIndex('openingHook', totalItems);
}

// Get next topic index
export async function getNextTopicIndex(totalItems: number): Promise<number> {
  return getNextIndex('topic', totalItems);
}

// Get current counters (for debugging/display)
export async function getRotationCounters(): Promise<{
  music: number;
  overlay: number;
  colorScheme: number;
  openingHook: number;
  topic: number;
}> {
  const counter = await prisma.rotationCounter.findUnique({
    where: { id: 'singleton' },
  });

  return {
    music: counter?.music ?? 0,
    overlay: counter?.overlay ?? 0,
    colorScheme: counter?.colorScheme ?? 0,
    openingHook: counter?.openingHook ?? 0,
    topic: counter?.topic ?? 0,
  };
}
