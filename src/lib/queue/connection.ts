import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Lazy singleton Redis connection for BullMQ
// ---------------------------------------------------------------------------

let redisInstance: Redis | null = null;

/**
 * Returns a shared IORedis instance configured for BullMQ.
 * Uses REDIS_URL from environment with localhost fallback.
 * maxRetriesPerRequest must be null for BullMQ compatibility.
 */
export function getRedisConnection(): Redis {
  if (!redisInstance) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';

    redisInstance = new Redis(url, {
      maxRetriesPerRequest: null,
    });
  }

  return redisInstance;
}
