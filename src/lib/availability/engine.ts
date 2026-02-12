/**
 * Availability Calculation Engine — Core Differentiator
 *
 * Pure function with no side effects or DB access.
 * All data is passed in, making it fully testable.
 *
 * Formula:
 *   Available Slots = Working Hours
 *     MINUS  Calendar Busy Events
 *     PLUS   Manual "Available" Overrides (open time outside working hours)
 *     MINUS  Manual "Blocked" Overrides
 *     MINUS  Existing Bookings (with buffer time)
 *     MINUS  Slots before minimum notice period
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface WorkingHourSlot {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface Override {
  type: 'available' | 'blocked';
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface AvailabilityInput {
  date: Date; // The specific date to calculate for (in the target timezone)
  timezone: string; // e.g. "Europe/London"
  workingHours: WorkingHourSlot[]; // User's working hours for this day-of-week
  overrides: Override[]; // Overrides applicable to this date (already resolved from RRULE)
  busyEvents: TimeRange[]; // Calendar busy events for this date
  existingBookings: TimeRange[]; // Existing confirmed bookings for this date
  durationMins: number; // Booking type duration
  bufferMins: number; // Buffer time after each booking
  minNoticeMs: number; // Minimum notice period in milliseconds
  now: Date; // Current time (injected for testability)
}

export interface AvailableSlot {
  start: Date;
  end: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "HH:MM" into a Date on the given date in the given timezone */
export function timeToDate(date: Date, time: string, timezone: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  // Build an ISO string in the target timezone using Intl.DateTimeFormat
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Create a date at the specified local time
  const localDate = new Date(year, month, day, hours, minutes, 0, 0);

  // Get the UTC offset for this timezone at this date/time
  const utcDate = new Date(
    localDate.toLocaleString('en-US', { timeZone: 'UTC' }),
  );
  const tzDate = new Date(
    localDate.toLocaleString('en-US', { timeZone: timezone }),
  );
  const offsetMs = utcDate.getTime() - tzDate.getTime();

  return new Date(localDate.getTime() + offsetMs);
}

/** Subtract a set of time ranges from another set of time ranges */
function subtractRanges(
  base: TimeRange[],
  subtract: TimeRange[],
): TimeRange[] {
  let result = [...base];

  for (const sub of subtract) {
    const next: TimeRange[] = [];

    for (const range of result) {
      // No overlap — keep the range
      if (sub.end.getTime() <= range.start.getTime() || sub.start.getTime() >= range.end.getTime()) {
        next.push(range);
        continue;
      }

      // Overlap — split into up to 2 parts
      if (sub.start.getTime() > range.start.getTime()) {
        next.push({ start: range.start, end: sub.start });
      }
      if (sub.end.getTime() < range.end.getTime()) {
        next.push({ start: sub.end, end: range.end });
      }
    }

    result = next;
  }

  return result;
}

/** Merge overlapping or adjacent time ranges */
function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length <= 1) return ranges;

  const sorted = [...ranges].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const merged: TimeRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (current.start.getTime() <= last.end.getTime()) {
      // Overlapping or adjacent — extend
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      merged.push(current);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

/**
 * Calculate available time slots for a specific date.
 *
 * 1. Start with working hours for the day
 * 2. Add "available" overrides (opens time outside working hours)
 * 3. Subtract "blocked" overrides
 * 4. Subtract calendar busy events
 * 5. Subtract existing bookings (with buffer time applied)
 * 6. Remove slots before minimum notice period
 * 7. Split remaining ranges into bookable slots of the correct duration
 */
export function calculateAvailableSlots(
  input: AvailabilityInput,
): AvailableSlot[] {
  const {
    date,
    timezone,
    workingHours,
    overrides,
    busyEvents,
    existingBookings,
    durationMins,
    bufferMins,
    minNoticeMs,
    now,
  } = input;

  const dayOfWeek = date.getDay();

  // 1. Start with working hours for this day
  const workingRanges: TimeRange[] = workingHours
    .filter((wh) => wh.dayOfWeek === dayOfWeek)
    .map((wh) => ({
      start: timeToDate(date, wh.startTime, timezone),
      end: timeToDate(date, wh.endTime, timezone),
    }));

  // 2. Add "available" overrides
  const availableOverrides: TimeRange[] = overrides
    .filter((o) => o.type === 'available')
    .map((o) => ({
      start: timeToDate(date, o.startTime, timezone),
      end: timeToDate(date, o.endTime, timezone),
    }));

  // Merge working hours + available overrides
  let availableRanges = mergeRanges([...workingRanges, ...availableOverrides]);

  // 3. Subtract "blocked" overrides
  const blockedOverrides: TimeRange[] = overrides
    .filter((o) => o.type === 'blocked')
    .map((o) => ({
      start: timeToDate(date, o.startTime, timezone),
      end: timeToDate(date, o.endTime, timezone),
    }));

  availableRanges = subtractRanges(availableRanges, blockedOverrides);

  // 4. Subtract calendar busy events
  availableRanges = subtractRanges(availableRanges, busyEvents);

  // 5. Subtract existing bookings with buffer time
  const bookingsWithBuffer: TimeRange[] = existingBookings.map((booking) => ({
    start: booking.start,
    end: new Date(booking.end.getTime() + bufferMins * 60 * 1000),
  }));

  availableRanges = subtractRanges(availableRanges, bookingsWithBuffer);

  // 6. Remove time before minimum notice period
  const earliestStart = new Date(now.getTime() + minNoticeMs);
  availableRanges = availableRanges
    .map((range) => ({
      start: new Date(Math.max(range.start.getTime(), earliestStart.getTime())),
      end: range.end,
    }))
    .filter((range) => range.end.getTime() > range.start.getTime());

  // 7. Split into bookable time slots
  const slotDurationMs = durationMins * 60 * 1000;
  const slots: AvailableSlot[] = [];

  for (const range of availableRanges) {
    let slotStart = range.start;

    while (slotStart.getTime() + slotDurationMs <= range.end.getTime()) {
      slots.push({
        start: new Date(slotStart),
        end: new Date(slotStart.getTime() + slotDurationMs),
      });

      // Move to next slot start — aligned to the slot duration
      slotStart = new Date(slotStart.getTime() + slotDurationMs);
    }
  }

  return slots;
}
