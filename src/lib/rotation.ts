import { prisma } from './prisma';

type RotationType = 'music' | 'overlay' | 'colorScheme' | 'openingHook';

// Valid column names for rotation counters (used to safely build raw SQL)
const validColumns: Record<RotationType, string> = {
  music: 'music',
  overlay: 'overlay',
  colorScheme: 'colorScheme',
  openingHook: 'openingHook',
};

// Ensure rotation counter exists and get next index for a given type
// Counter stores "the next index to use" - we read it, use it, then increment
async function getNextIndex(type: RotationType, totalItems: number): Promise<number> {
  if (totalItems === 0) return -1;

  const col = validColumns[type];

  // Ensure counter row exists
  await prisma.rotationCounter.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', music: 0, overlay: 0, colorScheme: 0, openingHook: 0, topic: 0 },
    update: {},
  });

  // Atomic increment-and-return using raw SQL.
  // The UPDATE takes a row-level lock in PostgreSQL, so concurrent calls
  // serialize properly and can never read the same counter value.
  const result = await prisma.$queryRawUnsafe<[{ prev: bigint }]>(
    `UPDATE "RotationCounter" SET "${col}" = "${col}" + 1, "updatedAt" = NOW() WHERE "id" = 'singleton' RETURNING "${col}" - 1 AS "prev"`
  );

  const previousValue = Number(result[0].prev);
  return previousValue % totalItems;
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

// Get current counters (for debugging/display)
export async function getRotationCounters(): Promise<{
  music: number;
  overlay: number;
  colorScheme: number;
  openingHook: number;
}> {
  const counter = await prisma.rotationCounter.findUnique({
    where: { id: 'singleton' },
  });

  return {
    music: counter?.music ?? 0,
    overlay: counter?.overlay ?? 0,
    colorScheme: counter?.colorScheme ?? 0,
    openingHook: counter?.openingHook ?? 0,
  };
}
