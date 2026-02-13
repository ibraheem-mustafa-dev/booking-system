import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock BullMQ and the Redis connection before importing the module under test
// ---------------------------------------------------------------------------

const mockAdd = vi.fn();
const mockGetJob = vi.fn();

vi.mock('bullmq', () => {
  return {
    Queue: class MockQueue {
      add = mockAdd;
      getJob = mockGetJob;
    },
  };
});

vi.mock('./connection', () => ({
  getRedisConnection: vi.fn().mockReturnValue({}),
}));

// Import after mocks are in place
import { scheduleEmailJob } from './email';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scheduleEmailJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for a past date', async () => {
    const pastDate = new Date(Date.now() - 60_000); // 1 minute ago

    const result = await scheduleEmailJob(
      { type: 'confirmation', bookingId: 'booking-123' },
      pastDate,
    );

    expect(result).toBeNull();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('schedules a job with correct delay for a future date', async () => {
    const futureDelay = 60_000; // 1 minute from now
    const futureDate = new Date(Date.now() + futureDelay);

    mockAdd.mockResolvedValue({ id: 'job-456' });

    const result = await scheduleEmailJob(
      { type: '24h_reminder', bookingId: 'booking-789', reminderId: 'reminder-001' },
      futureDate,
    );

    expect(result).not.toBeNull();
    expect(result!.id).toBe('job-456');

    // Verify the add call
    expect(mockAdd).toHaveBeenCalledTimes(1);
    const [jobName, jobData, jobOptions] = mockAdd.mock.calls[0];

    expect(jobName).toBe('24h_reminder');
    expect(jobData).toEqual({
      type: '24h_reminder',
      bookingId: 'booking-789',
      reminderId: 'reminder-001',
    });

    // Delay should be within 5 seconds of expected (accounts for test execution time)
    expect(jobOptions.delay).toBeGreaterThan(0);
    expect(jobOptions.delay).toBeLessThanOrEqual(futureDelay + 5000);
  });
});
