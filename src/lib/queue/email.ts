import { Queue } from 'bullmq';
import { getRedisConnection } from './connection';

// ---------------------------------------------------------------------------
// Email Job Data — union type covering all email job types
// ---------------------------------------------------------------------------

export type EmailJobData =
  | { type: 'confirmation'; bookingId: string }
  | { type: 'notification'; bookingId: string }
  | { type: '24h_reminder'; bookingId: string; reminderId: string }
  | { type: '1h_reminder'; bookingId: string; reminderId: string }
  | { type: 'review_request'; bookingId: string; reminderId: string }
  | { type: 'follow_up'; bookingId: string; reminderId: string };

// ---------------------------------------------------------------------------
// Lazy singleton email queue
// ---------------------------------------------------------------------------

let emailQueue: Queue | null = null;

/**
 * Returns a shared BullMQ Queue for email jobs.
 * Configured with exponential backoff retries and automatic cleanup.
 */
export function getEmailQueue(): Queue {
  if (!emailQueue) {
    emailQueue = new Queue('email', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 second base delay
        },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }

  return emailQueue;
}

// ---------------------------------------------------------------------------
// Scheduling helpers
// ---------------------------------------------------------------------------

/**
 * Schedule an email job to be sent at a specific time.
 * Returns the BullMQ Job on success, or null if the sendAt time is in the past.
 */
export async function scheduleEmailJob(
  data: EmailJobData,
  sendAt: Date,
): Promise<{ id: string } | null> {
  const delay = sendAt.getTime() - Date.now();

  if (delay < 0) {
    return null;
  }

  const queue = getEmailQueue();
  const job = await queue.add(data.type, data, { delay });

  return { id: job.id! };
}

/**
 * Remove a scheduled email job by its BullMQ job ID.
 * Silently handles cases where the job has already been processed or removed.
 */
export async function removeEmailJob(jobId: string): Promise<void> {
  const queue = getEmailQueue();

  try {
    const job = await queue.getJob(jobId);

    if (job) {
      await job.remove();
    }
  } catch (error) {
    // Job may have already been processed or removed — log and move on
    console.error(`Failed to remove email job ${jobId}:`, error);
  }
}
