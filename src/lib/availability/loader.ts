/**
 * Availability Data Loader
 *
 * Loads all inputs for the availability engine from the database.
 * Bridges the pure calculation engine with the DB layer.
 */

import { db } from '@/lib/db';
import {
  workingHours,
  availabilityOverrides,
  bookings,
  calendarAccounts,
  calendarConnections,
  organisations,
  bookingTypes,
} from '@/lib/db/schema';
import { eq, and, gte, lte, ne } from 'drizzle-orm';
import {
  calculateAvailableSlots,
  type AvailabilityInput,
  type WorkingHourSlot,
  type Override,
  type TimeRange,
  type AvailableSlot,
  timeToDate,
} from './engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoadAvailabilityParams {
  orgSlug: string;
  typeSlug: string;
  date: string; // YYYY-MM-DD
  timezone: string;
}

export interface LoadedAvailability {
  slots: AvailableSlot[];
  organisation: {
    name: string;
    branding: Record<string, unknown>;
  };
  bookingType: {
    id: string;
    name: string;
    description: string | null;
    durationMins: number;
    bufferMins: number;
    locationType: string;
    customFields: Record<string, unknown>;
    priceAmount: string | null;
    priceCurrency: string | null;
    requiresPayment: boolean;
    colour: string;
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load availability for a specific date from the database and calculate slots.
 * Returns the available time slots along with org and booking type metadata.
 */
export async function loadAvailability(
  params: LoadAvailabilityParams,
): Promise<LoadedAvailability | { error: string; status: number }> {
  const { orgSlug, typeSlug, date, timezone } = params;

  // 1. Look up organisation
  const [org] = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      branding: organisations.branding,
      ownerId: organisations.ownerId,
    })
    .from(organisations)
    .where(eq(organisations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return { error: 'Organisation not found.', status: 404 };
  }

  // 2. Look up booking type
  const [type] = await db
    .select()
    .from(bookingTypes)
    .where(
      and(
        eq(bookingTypes.orgId, org.id),
        eq(bookingTypes.slug, typeSlug),
        eq(bookingTypes.isActive, true),
      ),
    )
    .limit(1);

  if (!type) {
    return { error: 'Booking type not found or inactive.', status: 404 };
  }

  // 3. Determine the organiser (org owner for now — team routing in Phase 2)
  const organiserId = org.ownerId;

  // 4. Parse the target date
  const [year, month, day] = date.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const dayOfWeek = targetDate.getDay();

  // 5. Load working hours for this user
  const userWorkingHours = await db
    .select({
      dayOfWeek: workingHours.dayOfWeek,
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
    })
    .from(workingHours)
    .where(eq(workingHours.userId, organiserId));

  const workingHourSlots: WorkingHourSlot[] = userWorkingHours.map((wh) => ({
    dayOfWeek: wh.dayOfWeek,
    startTime: wh.startTime.slice(0, 5), // "09:00:00" → "09:00"
    endTime: wh.endTime.slice(0, 5),
  }));

  // 6. Load overrides for this date
  const userOverrides = await db
    .select({
      type: availabilityOverrides.type,
      startTime: availabilityOverrides.startTime,
      endTime: availabilityOverrides.endTime,
      date: availabilityOverrides.date,
      isRecurring: availabilityOverrides.isRecurring,
      recurrenceRule: availabilityOverrides.recurrenceRule,
    })
    .from(availabilityOverrides)
    .where(eq(availabilityOverrides.userId, organiserId));

  // Filter to overrides that apply to this date
  const applicableOverrides: Override[] = userOverrides
    .filter((o) => {
      if (!o.isRecurring && o.date) {
        // Specific date override
        return o.date === date;
      }
      if (o.isRecurring && o.recurrenceRule) {
        // Simple RRULE matching for weekly patterns
        return matchesRecurrenceRule(o.recurrenceRule, dayOfWeek);
      }
      return false;
    })
    .map((o) => ({
      type: o.type,
      startTime: o.startTime.slice(0, 5),
      endTime: o.endTime.slice(0, 5),
    }));

  // 7. Load existing bookings for this date
  const dayStart = timeToDate(targetDate, '00:00', timezone);
  const dayEnd = timeToDate(targetDate, '23:59', timezone);

  const existingBookings = await db
    .select({
      startAt: bookings.startAt,
      endAt: bookings.endAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.organiserId, organiserId),
        ne(bookings.status, 'cancelled'),
        gte(bookings.startAt, dayStart),
        lte(bookings.startAt, dayEnd),
      ),
    );

  const bookingRanges: TimeRange[] = existingBookings.map((b) => ({
    start: b.startAt,
    end: b.endAt,
  }));

  // 8. Load calendar busy events (skip if no calendars connected)
  const busyEvents: TimeRange[] = [];
  try {
    const accounts = await db
      .select({ id: calendarAccounts.id })
      .from(calendarAccounts)
      .where(eq(calendarAccounts.userId, organiserId));

    if (accounts.length > 0) {
      // Get selected calendar connections
      for (const account of accounts) {
        const connections = await db
          .select({ externalId: calendarConnections.externalId })
          .from(calendarConnections)
          .where(
            and(
              eq(calendarConnections.calendarAccountId, account.id),
              eq(calendarConnections.isSelected, true),
            ),
          );

        if (connections.length > 0) {
          // Dynamic import to avoid loading googleapis when not needed
          const { fetchBusyTimes } = await import('@/lib/calendar/google');
          const calendarIds = connections.map((c) => c.externalId);
          const busy = await fetchBusyTimes(
            account.id,
            calendarIds,
            dayStart,
            dayEnd,
            timezone,
          );
          busyEvents.push(
            ...busy.map((b) => ({ start: b.start, end: b.end })),
          );
        }
      }
    }
  } catch {
    // Calendar fetch failures shouldn't block availability
    // The user can still book based on working hours + overrides
  }

  // 9. Calculate available slots
  const input: AvailabilityInput = {
    date: targetDate,
    timezone,
    workingHours: workingHourSlots,
    overrides: applicableOverrides,
    busyEvents,
    existingBookings: bookingRanges,
    durationMins: type.durationMins,
    bufferMins: type.bufferMins,
    minNoticeMs: type.minNoticeHours * 60 * 60 * 1000,
    now: new Date(),
  };

  const slots = calculateAvailableSlots(input);

  // Strip customCss from branding before returning to public consumers (XSS vector)
  const publicBranding = { ...(org.branding as Record<string, unknown>) };
  delete publicBranding.customCss;

  return {
    slots,
    organisation: {
      name: org.name,
      branding: publicBranding,
    },
    bookingType: {
      id: type.id,
      name: type.name,
      description: type.description,
      durationMins: type.durationMins,
      bufferMins: type.bufferMins,
      locationType: type.locationType,
      customFields: type.customFields as Record<string, unknown>,
      priceAmount: type.priceAmount,
      priceCurrency: type.priceCurrency,
      requiresPayment: type.requiresPayment,
      colour: type.colour,
    },
  };
}

// ---------------------------------------------------------------------------
// RRULE Matching (simplified for weekly patterns)
// ---------------------------------------------------------------------------

const DAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

/**
 * Simple RRULE matcher for weekly recurrence patterns.
 * Handles: FREQ=WEEKLY;BYDAY=MO,TU,WE etc.
 * Does not handle monthly patterns yet (BYDAY=1MO etc.).
 */
function matchesRecurrenceRule(rule: string, dayOfWeek: number): boolean {
  const parts = rule.split(';');
  const freqPart = parts.find((p) => p.startsWith('FREQ='));
  const byDayPart = parts.find((p) => p.startsWith('BYDAY='));

  if (!freqPart || !byDayPart) return false;

  const freq = freqPart.replace('FREQ=', '');
  if (freq !== 'WEEKLY') return false;

  const days = byDayPart.replace('BYDAY=', '').split(',');
  return days.some((d) => DAY_MAP[d.trim()] === dayOfWeek);
}
