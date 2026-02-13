import Redis from 'ioredis';
import type { ConnectionOptions } from 'bullmq';

// ---------------------------------------------------------------------------
// Lazy singleton Redis connection for BullMQ
// ---------------------------------------------------------------------------

let redisInstance: Redis | null = null;

/**
 * Returns a shared IORedis instance configured for BullMQ.
 * Uses REDIS_URL from environment with localhost fallback.
 * maxRetriesPerRequest must be null for BullMQ compatibility.
 *
 * The return type is cast to BullMQ's ConnectionOptions because ioredis
 * patch versions can drift between the top-level install and BullMQ's
 * bundled copy, causing spurious type errors.
 */
export function getRedisConnection(): ConnectionOptions {
  if (!redisInstance) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';

    redisInstance = new Redis(url, {
      maxRetriesPerRequest: null,
    });
  }

  return redisInstance as unknown as ConnectionOptions;
}
