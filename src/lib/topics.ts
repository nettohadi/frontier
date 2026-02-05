import { prisma } from './prisma';
import type { Topic } from '@prisma/client';

/**
 * Get the next topic for video generation.
 * Stores nextTopicId directly so "Set as Next" is exact — no indirection.
 * Uses SELECT FOR UPDATE inside a transaction to prevent race conditions
 * when multiple videos are generated concurrently (batch generation).
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
    const counters = await tx.$queryRaw<Array<{ nextTopicId: string | null }>>`
      SELECT "nextTopicId" FROM "RotationCounter"
      WHERE "id" = 'singleton' FOR UPDATE
    `;

    const nextTopicId = counters[0]?.nextTopicId;
    let topic: Topic | null = null;

    if (nextTopicId) {
      // Use the stored next topic if it's still active
      topic = await tx.topic.findFirst({
        where: { id: nextTopicId, isActive: true },
      });
    }

    // Fallback: first active topic by creation order
    if (!topic) {
      topic = await tx.topic.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!topic) {
      throw new Error('No active topics found in database');
    }

    // Calculate the next topic after this one for future use
    let upcoming = await tx.topic.findFirst({
      where: { isActive: true, createdAt: { gt: topic.createdAt } },
      orderBy: { createdAt: 'asc' },
    });
    // Wrap around to the first active topic if at the end
    if (!upcoming) {
      upcoming = await tx.topic.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    // Store the upcoming topic as the next one to use
    await tx.rotationCounter.update({
      where: { id: 'singleton' },
      data: { nextTopicId: upcoming?.id ?? null },
    });

    // Update usage tracking
    await tx.topic.update({
      where: { id: topic.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return topic;
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
