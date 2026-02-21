import { describe, it, expect } from 'vitest';
import {
  calculateAvailableSlots,
  timeToDate,
  type AvailabilityInput,
} from './engine';

// ---------------------------------------------------------------------------
// Helper: build a default input for a Monday with 09:00-17:00 working hours
// ---------------------------------------------------------------------------

const TIMEZONE = 'Europe/London';

// A Monday in February 2026 (Monday = dayOfWeek 1)
const FEB_2 = new Date(2026, 1, 2); // Monday 2 Feb 2026

function defaultInput(overrides?: Partial<AvailabilityInput>): AvailabilityInput {
  return {
    date: FEB_2,
    timezone: TIMEZONE,
    workingHours: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
    ],
    overrides: [],
    busyEvents: [],
    existingBookings: [],
    durationMins: 30,
    bufferMins: 0,
    minNoticeMs: 0,
    now: new Date(2026, 1, 1), // Sunday 1 Feb 2026 — well before the target date
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// timeToDate helper
// ---------------------------------------------------------------------------

describe('timeToDate', () => {
  it('converts HH:MM to a Date on the given date', () => {
    const result = timeToDate(FEB_2, '09:30', TIMEZONE);
    // Should be 09:30 in Europe/London on 2 Feb 2026
    const hours = new Date(
      result.toLocaleString('en-US', { timeZone: TIMEZONE }),
    );
    expect(hours.getHours()).toBe(9);
    expect(hours.getMinutes()).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Basic working hours
// ---------------------------------------------------------------------------

describe('calculateAvailableSlots', () => {
  it('returns 30-minute slots for a standard 09:00-17:00 day', () => {
    const slots = calculateAvailableSlots(defaultInput());

    // 8 hours = 480 minutes / 30 = 16 slots
    expect(slots).toHaveLength(16);

    // First slot starts at 09:00
    const firstStart = new Date(
      slots[0].start.toLocaleString('en-US', { timeZone: TIMEZONE }),
    );
    expect(firstStart.getHours()).toBe(9);
    expect(firstStart.getMinutes()).toBe(0);

    // Last slot starts at 16:30
    const lastStart = new Date(
      slots[15].start.toLocaleString('en-US', { timeZone: TIMEZONE }),
    );
    expect(lastStart.getHours()).toBe(16);
    expect(lastStart.getMinutes()).toBe(30);
  });

  it('returns 60-minute slots for a 1-hour duration', () => {
    const slots = calculateAvailableSlots(
      defaultInput({ durationMins: 60 }),
    );

    // 8 hours / 60 minutes = 8 slots
    expect(slots).toHaveLength(8);
  });

  it('returns empty when no working hours for the day', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        workingHours: [
          // Only Tuesday has hours (dayOfWeek=2), but our date is Monday (1)
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
        ],
      }),
    );

    expect(slots).toHaveLength(0);
  });

  it('handles multiple working hour slots (split schedule)', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        workingHours: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }, // Morning
          { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' }, // Afternoon
        ],
      }),
    );

    // 3 hours morning + 3 hours afternoon = 6 hours = 12 slots at 30 min
    expect(slots).toHaveLength(12);
  });

  // ---------------------------------------------------------------------------
  // Overrides
  // ---------------------------------------------------------------------------

  it('blocks time with a "blocked" override', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        overrides: [{ type: 'blocked', startTime: '12:00', endTime: '13:00' }],
      }),
    );

    // 8 hours - 1 hour blocked = 7 hours = 14 slots
    expect(slots).toHaveLength(14);

    // No slots should start at 12:00 or 12:30
    const slotTimes = slots.map((s) => {
      const d = new Date(
        s.start.toLocaleString('en-US', { timeZone: TIMEZONE }),
      );
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });
    expect(slotTimes).not.toContain('12:00');
    expect(slotTimes).not.toContain('12:30');
  });

  it('opens time with an "available" override outside working hours', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        overrides: [
          { type: 'available', startTime: '07:00', endTime: '09:00' },
        ],
      }),
    );

    // 8 hours working + 2 hours override = 10 hours = 20 slots
    expect(slots).toHaveLength(20);
  });

  it('available override during working hours has no double effect', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        overrides: [
          { type: 'available', startTime: '10:00', endTime: '11:00' },
        ],
      }),
    );

    // Should still be 16 slots — the override overlaps existing working hours
    expect(slots).toHaveLength(16);
  });

  it('blocked override takes precedence over available override', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        overrides: [
          { type: 'available', startTime: '07:00', endTime: '09:00' },
          { type: 'blocked', startTime: '07:00', endTime: '08:00' },
        ],
      }),
    );

    // Working hours 09-17 (8h) + available 07-09 (2h) - blocked 07-08 (1h) = 9h = 18 slots
    expect(slots).toHaveLength(18);
  });

  // ---------------------------------------------------------------------------
  // Calendar busy events
  // ---------------------------------------------------------------------------

  it('removes time occupied by calendar busy events', () => {
    const busyStart = timeToDate(FEB_2, '10:00', TIMEZONE);
    const busyEnd = timeToDate(FEB_2, '11:00', TIMEZONE);

    const slots = calculateAvailableSlots(
      defaultInput({
        busyEvents: [{ start: busyStart, end: busyEnd }],
      }),
    );

    // 8h - 1h = 7h = 14 slots
    expect(slots).toHaveLength(14);
  });

  it('handles overlapping busy events', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        busyEvents: [
          {
            start: timeToDate(FEB_2, '10:00', TIMEZONE),
            end: timeToDate(FEB_2, '11:00', TIMEZONE),
          },
          {
            start: timeToDate(FEB_2, '10:30', TIMEZONE),
            end: timeToDate(FEB_2, '11:30', TIMEZONE),
          },
        ],
      }),
    );

    // The two events overlap to block 10:00-11:30 = 1.5h
    // 8h - 1.5h = 6.5h = 13 slots
    expect(slots).toHaveLength(13);
  });

  // ---------------------------------------------------------------------------
  // Existing bookings with buffer
  // ---------------------------------------------------------------------------

  it('removes existing bookings', () => {
    const bookingStart = timeToDate(FEB_2, '14:00', TIMEZONE);
    const bookingEnd = timeToDate(FEB_2, '14:30', TIMEZONE);

    const slots = calculateAvailableSlots(
      defaultInput({
        existingBookings: [{ start: bookingStart, end: bookingEnd }],
      }),
    );

    // 8h - 0.5h = 7.5h = 15 slots
    expect(slots).toHaveLength(15);
  });

  it('applies buffer time after existing bookings', () => {
    const bookingStart = timeToDate(FEB_2, '14:00', TIMEZONE);
    const bookingEnd = timeToDate(FEB_2, '14:30', TIMEZONE);

    const slots = calculateAvailableSlots(
      defaultInput({
        existingBookings: [{ start: bookingStart, end: bookingEnd }],
        bufferMins: 15,
      }),
    );

    // Booking 14:00-14:30, buffer makes it 14:00-14:45
    // This blocks the 14:00 slot AND most of the 14:30 slot
    // Available: 09:00-14:00 (10 slots) + 14:45-17:00 (4 slots with 15min lost at start)
    // Actually: 14:45 to 15:00 is only 15 min, not enough for a 30-min slot
    // So: 09:00-14:00 (10 slots) + 15:00-17:00 (4 slots) = 14 slots

    // Let me think again:
    // 09:00-14:00 = 5 hours = 10 x 30min slots
    // 14:45 onwards: first possible 30-min slot is at 14:45-15:15? No — slots align to available range start
    // The available range after subtraction is 14:45-17:00
    // Slots: 14:45-15:15, 15:15-15:45, 15:45-16:15, 16:15-16:45 = 4 slots
    // (16:45-17:15 would exceed 17:00, so no 5th slot)
    // Total: 10 + 4 = 14 slots
    expect(slots).toHaveLength(14);
  });

  // ---------------------------------------------------------------------------
  // Minimum notice period
  // ---------------------------------------------------------------------------

  it('removes slots before minimum notice period', () => {
    // "now" is 11:00 on the target day, 2h minimum notice
    const now = timeToDate(FEB_2, '11:00', TIMEZONE);

    const slots = calculateAvailableSlots(
      defaultInput({
        now,
        minNoticeMs: 2 * 60 * 60 * 1000, // 2 hours
      }),
    );

    // Earliest slot starts at 13:00 (11:00 + 2h notice)
    // 13:00-17:00 = 4 hours = 8 slots
    expect(slots).toHaveLength(8);

    const firstStart = new Date(
      slots[0].start.toLocaleString('en-US', { timeZone: TIMEZONE }),
    );
    expect(firstStart.getHours()).toBe(13);
  });

  it('returns empty when entire day is within notice period', () => {
    // "now" is 16:00, 2h notice means earliest is 18:00 — past working hours
    const now = timeToDate(FEB_2, '16:00', TIMEZONE);

    const slots = calculateAvailableSlots(
      defaultInput({
        now,
        minNoticeMs: 2 * 60 * 60 * 1000,
      }),
    );

    expect(slots).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('returns empty for zero-length working hours', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '09:00' }],
      }),
    );

    expect(slots).toHaveLength(0);
  });

  it('handles a duration longer than any available gap', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        workingHours: [{ dayOfWeek: 1, startTime: '09:00', endTime: '09:30' }],
        durationMins: 60, // Need 60 min but only have 30 min
      }),
    );

    expect(slots).toHaveLength(0);
  });

  it('busy event exactly covers working hours', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        busyEvents: [
          {
            start: timeToDate(FEB_2, '09:00', TIMEZONE),
            end: timeToDate(FEB_2, '17:00', TIMEZONE),
          },
        ],
      }),
    );

    expect(slots).toHaveLength(0);
  });

  it('busy event partially overlaps start of working hours', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        busyEvents: [
          {
            start: timeToDate(FEB_2, '08:00', TIMEZONE),
            end: timeToDate(FEB_2, '10:00', TIMEZONE),
          },
        ],
      }),
    );

    // Working hours 09:00-17:00, busy covers 08:00-10:00
    // Available: 10:00-17:00 = 7h = 14 slots
    expect(slots).toHaveLength(14);
  });

  it('busy event partially overlaps end of working hours', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        busyEvents: [
          {
            start: timeToDate(FEB_2, '16:00', TIMEZONE),
            end: timeToDate(FEB_2, '18:00', TIMEZONE),
          },
        ],
      }),
    );

    // Available: 09:00-16:00 = 7h = 14 slots
    expect(slots).toHaveLength(14);
  });

  it('combines all constraint types together', () => {
    // Working hours: 09:00-17:00
    // Available override: 07:00-09:00 (+2h)
    // Blocked override: 12:00-13:00 (-1h)
    // Busy event: 10:00-11:00 (-1h)
    // Existing booking: 15:00-15:30 with 15min buffer (-0.75h total)
    // No notice period
    const slots = calculateAvailableSlots(
      defaultInput({
        overrides: [
          { type: 'available', startTime: '07:00', endTime: '09:00' },
          { type: 'blocked', startTime: '12:00', endTime: '13:00' },
        ],
        busyEvents: [
          {
            start: timeToDate(FEB_2, '10:00', TIMEZONE),
            end: timeToDate(FEB_2, '11:00', TIMEZONE),
          },
        ],
        existingBookings: [
          {
            start: timeToDate(FEB_2, '15:00', TIMEZONE),
            end: timeToDate(FEB_2, '15:30', TIMEZONE),
          },
        ],
        bufferMins: 15,
      }),
    );

    // Available ranges after all subtractions:
    // 07:00-10:00 (3h = 6 slots)
    // 11:00-12:00 (1h = 2 slots)
    // 13:00-15:00 (2h = 4 slots)
    // 15:45-17:00 (1h15m = 2 slots: 15:45-16:15, 16:15-16:45)
    // Total: 6 + 2 + 4 + 2 = 14 slots
    expect(slots).toHaveLength(14);
  });

  it('handles 15-minute duration for short consultations', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        durationMins: 15,
      }),
    );

    // 8 hours = 480 min / 15 = 32 slots
    expect(slots).toHaveLength(32);
  });

  it('handles 45-minute duration (leaves remainder unused)', () => {
    const slots = calculateAvailableSlots(
      defaultInput({
        durationMins: 45,
      }),
    );

    // 8 hours = 480 min / 45 = 10.67 → 10 slots (last 30 min is unusable)
    expect(slots).toHaveLength(10);
  });
});
