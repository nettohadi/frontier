import { prisma } from './prisma';

type RotationType = 'music' | 'overlay' | 'colorScheme';

// Ensure rotation counter exists and get next index for a given type
async function getNextIndex(type: RotationType, totalItems: number): Promise<number> {
  if (totalItems === 0) return -1;

  // Upsert to ensure row exists, then increment and get new value
  const counter = await prisma.rotationCounter.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', music: 0, overlay: 0, colorScheme: 0 },
    update: {
      [type]: {
        increment: 1,
      },
    },
  });

  // Get the current value (after increment) and wrap around
  const currentValue = counter[type];
  const index = currentValue % totalItems;

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

// Get current counters (for debugging/display)
export async function getRotationCounters(): Promise<{ music: number; overlay: number; colorScheme: number }> {
  const counter = await prisma.rotationCounter.findUnique({
    where: { id: 'singleton' },
  });

  return {
    music: counter?.music ?? 0,
    overlay: counter?.overlay ?? 0,
    colorScheme: counter?.colorScheme ?? 0,
  };
}
