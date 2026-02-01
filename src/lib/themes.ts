import { prisma } from './prisma';
import type { Theme } from '@prisma/client';

/**
 * Get the next theme for video generation using round-robin rotation.
 * Prioritizes themes that haven't been used or were used longest ago.
 */
export async function getNextTheme(): Promise<Theme> {
  // Find the least recently used active theme
  const theme = await prisma.theme.findFirst({
    where: { isActive: true },
    orderBy: [
      { lastUsedAt: { sort: 'asc', nulls: 'first' } }, // Unused themes first
      { usageCount: 'asc' }, // Then by usage count
    ],
  });

  if (!theme) {
    throw new Error('No active themes found in database');
  }

  // Update usage tracking
  await prisma.theme.update({
    where: { id: theme.id },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  return theme;
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
