import { prisma } from './prisma';
import type { Topic } from '@prisma/client';
import { getNextTopicIndex } from './rotation';

/**
 * Get the next topic for video generation using atomic counter rotation.
 * Uses database-level atomic increment to prevent race conditions in batch generation.
 * Goes through topics by creation date (oldest first), cycling back to the start.
 */
export async function getNextTopic(): Promise<Topic> {
  // Get all active topics ordered by creation date (matches UI display order)
  const allTopics = await prisma.topic.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (allTopics.length === 0) {
    throw new Error('No active topics found in database');
  }

  // Get next index using atomic counter (prevents race condition in batch generation)
  const nextIndex = await getNextTopicIndex(allTopics.length);
  const nextTopic = allTopics[nextIndex];

  // Update usage tracking (non-critical, just for stats)
  await prisma.topic.update({
    where: { id: nextTopic.id },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  return nextTopic;
}

/**
 * Get a specific topic by name
 */
export async function getTopicByName(name: string): Promise<Topic | null> {
  return prisma.topic.findUnique({
    where: { name },
  });
}

/**
 * Get all active topics
 */
export async function getAllActiveTopics(): Promise<Topic[]> {
  return prisma.topic.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get topic usage statistics
 */
export async function getTopicStats(): Promise<{
  total: number;
  active: number;
  mostUsed: Topic | null;
  leastUsed: Topic | null;
}> {
  const [total, active, mostUsed, leastUsed] = await Promise.all([
    prisma.topic.count(),
    prisma.topic.count({ where: { isActive: true } }),
    prisma.topic.findFirst({
      where: { isActive: true },
      orderBy: { usageCount: 'desc' },
    }),
    prisma.topic.findFirst({
      where: { isActive: true },
      orderBy: { usageCount: 'asc' },
    }),
  ]);

  return { total, active, mostUsed, leastUsed };
}
