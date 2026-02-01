import Redis from 'ioredis';

export function createRedisConnection(): Redis {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null, // Required for BullMQ
  });
}

// Singleton connection for the app
let redisInstance: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisInstance) {
    redisInstance = createRedisConnection();
  }
  return redisInstance;
}
