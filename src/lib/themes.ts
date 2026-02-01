import { prisma } from './prisma';
import type { Theme } from '@prisma/client';

/**
 * Get the next theme for video generation using sequential rotation.
 * Goes through themes alphabetically by name, cycling back to the start.
 */
export async function getNextTheme(): Promise<Theme> {
  // Get all active themes ordered alphabetically (matches UI display order)
  const allThemes = await prisma.theme.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  if (allThemes.length === 0) {
    throw new Error('No active themes found in database');
  }

  // Find the last used theme
  const lastUsed = await prisma.theme.findFirst({
    where: { isActive: true, lastUsedAt: { not: null } },
    orderBy: { lastUsedAt: 'desc' },
  });

  let nextTheme: Theme;

  if (!lastUsed) {
    // No theme has been used yet, start with the first one
    nextTheme = allThemes[0];
  } else {
    // Find the index of the last used theme
    const lastIndex = allThemes.findIndex((t) => t.id === lastUsed.id);
    // Get the next theme in sequence (cycle back to 0 if at the end)
    const nextIndex = (lastIndex + 1) % allThemes.length;
    nextTheme = allThemes[nextIndex];
  }

  // Update usage tracking
  await prisma.theme.update({
    where: { id: nextTheme.id },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  return nextTheme;
}

/**
 * Get a specific theme by name
 */
export async function getThemeByName(name: string): Promise<Theme | null> {
  return prisma.theme.findUnique({
    where: { name },
  });
}

/**
 * Get all active themes
 */
export async function getAllActiveThemes(): Promise<Theme[]> {
  return prisma.theme.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Get theme usage statistics
 */
export async function getThemeStats(): Promise<{
  total: number;
  active: number;
  mostUsed: Theme | null;
  leastUsed: Theme | null;
}> {
  const [total, active, mostUsed, leastUsed] = await Promise.all([
    prisma.theme.count(),
    prisma.theme.count({ where: { isActive: true } }),
    prisma.theme.findFirst({
      where: { isActive: true },
      orderBy: { usageCount: 'desc' },
    }),
    prisma.theme.findFirst({
      where: { isActive: true },
      orderBy: { usageCount: 'asc' },
    }),
  ]);

  return { total, active, mostUsed, leastUsed };
}
