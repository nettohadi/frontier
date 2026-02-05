import { prisma } from './prisma';
import type { Topic } from '@prisma/client';

/**
 * Get the next topic for video generation using ID-based rotation.
 * Tracks the last used topic ID instead of a numeric counter, so
 * activating/deactivating topics never causes skips or repeats.
 * Uses SELECT FOR UPDATE inside a transaction to prevent race conditions.
 */
export async function getNextTopic(): Promise<Topic> {
  return await prisma.$transaction(async (tx) => {
    // Ensure counter row exists
    await tx.rotationCounter.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });

    // Lock the counter row to serialize concurrent calls
    const counters = await tx.$queryRaw<Array<{ lastTopicId: string | null }>>`
      SELECT "lastTopicId" FROM "RotationCounter"
      WHERE "id" = 'singleton' FOR UPDATE
    `;

    const lastTopicId = counters[0]?.lastTopicId;
    let nextTopic: Topic | null = null;

    if (lastTopicId) {
      // Find the last topic (even if deactivated) to get its createdAt
      const lastTopic = await tx.topic.findUnique({
        where: { id: lastTopicId },
        select: { createdAt: true },
      });

      if (lastTopic) {
        // Find the next active topic after the last one by creation order
        nextTopic = await tx.topic.findFirst({
          where: { isActive: true, createdAt: { gt: lastTopic.createdAt } },
          orderBy: { createdAt: 'asc' },
        });
      }
    }

    // Wrap around to the first active topic if no next found (end of list or first run)
    if (!nextTopic) {
      nextTopic = await tx.topic.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!nextTopic) {
      throw new Error('No active topics found in database');
    }

    // Update the counter with the new topic ID
    await tx.rotationCounter.update({
      where: { id: 'singleton' },
      data: { lastTopicId: nextTopic.id },
    });

    // Update usage tracking
    await tx.topic.update({
      where: { id: nextTopic.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return nextTopic;
  });
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
