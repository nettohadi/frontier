import { prisma } from './prisma';
import type { Topic } from '@prisma/client';

/**
 * Get the next topic for video generation using sequential rotation.
 * Goes through topics alphabetically by name, cycling back to the start.
 */
export async function getNextTopic(): Promise<Topic> {
  // Get all active topics ordered alphabetically (matches UI display order)
  const allTopics = await prisma.topic.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  if (allTopics.length === 0) {
    throw new Error('No active topics found in database');
  }

  // Find the last used topic
  const lastUsed = await prisma.topic.findFirst({
    where: { isActive: true, lastUsedAt: { not: null } },
    orderBy: { lastUsedAt: 'desc' },
  });

  let nextTopic: Topic;

  if (!lastUsed) {
    // No topic has been used yet, start with the first one
    nextTopic = allTopics[0];
  } else {
    // Find the index of the last used topic
    const lastIndex = allTopics.findIndex((t) => t.id === lastUsed.id);
    // Get the next topic in sequence (cycle back to 0 if at the end)
    const nextIndex = (lastIndex + 1) % allTopics.length;
    nextTopic = allTopics[nextIndex];
  }

  // Update usage tracking
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
    orderBy: { name: 'asc' },
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
