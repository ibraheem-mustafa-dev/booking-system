import { db } from '@/lib/db';
import {
  bookings,
  bookingTypes,
  organisations,
  users,
  bookingReminders,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { generateIcsFile } from '@/lib/calendar/ics';
import { sendEmail } from '@/lib/email/resend';
import { scheduleEmailJob } from '@/lib/queue/email';
import { ConfirmationEmail } from '@/lib/email/templates/confirmation';
import { NotificationEmail } from '@/lib/email/templates/notification';
import { createElement } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BookingEmailContext {
  bookingId: string;
  orgSlug: string;
  typeSlug: string;
}

interface EmailSettingsShape {
  reviewRequest: {
    enabled: boolean;
    delayMinutes: number;
    subject: string;
    body: string;
  };
  followUpReminder: {
    enabled: boolean;
    delayDays: number;
    subject: string;
    body: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Build a Google Calendar "add event" URL from booking details.
 */
function buildGoogleCalendarUrl(params: {
  title: string;
  startAt: Date;
  endAt: Date;
  description?: string;
  location?: string;
}): string {
  const { title, startAt, endAt, description, location } = params;

  // Google Calendar expects dates as YYYYMMDDTHHMMSSZ
  const formatGcal = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', title);
  url.searchParams.set('dates', `${formatGcal(startAt)}/${formatGcal(endAt)}`);

  if (description) {
    url.searchParams.set('details', description);
  }

  if (location) {
    url.searchParams.set('location', location);
  }

  return url.toString();
}

/**
 * Map custom field responses to label/value pairs using the booking type's
 * field definitions.
 */
function mapCustomFieldResponses(
  fields: {
    id: string;
    type: string;
    label: string;
    placeholder?: string;
    required: boolean;
    options?: string[];
  }[],
  responses: Record<string, string | boolean | string[]>,
): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = [];

  for (const field of fields) {
    const raw = responses[field.id];
    if (raw === undefined || raw === null || raw === '') continue;

    let value: string;
    if (Array.isArray(raw)) {
      value = raw.join(', ');
    } else if (typeof raw === 'boolean') {
      value = raw ? 'Yes' : 'No';
    } else {
      value = String(raw);
    }

    result.push({ label: field.label, value });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Core orchestration — called after a booking is created
// ---------------------------------------------------------------------------

/**
 * Send all booking-related emails and schedule reminders.
 *
 * This function NEVER throws. Email failures are logged but must not
 * crash the booking flow.
 */
export async function sendBookingEmails(
  ctx: BookingEmailContext,
): Promise<void> {
  try {
    // -----------------------------------------------------------------------
    // 1. Load data from database
    // -----------------------------------------------------------------------
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, ctx.bookingId))
      .limit(1);

    if (!booking) {
      console.error(`[email] Booking ${ctx.bookingId} not found`);
      return;
    }

    const [bookingType] = await db
      .select()
      .from(bookingTypes)
      .where(eq(bookingTypes.id, booking.bookingTypeId))
      .limit(1);

    if (!bookingType) {
      console.error(`[email] BookingType ${booking.bookingTypeId} not found`);
      return;
    }

    const [org] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, booking.orgId))
      .limit(1);

    if (!org) {
      console.error(`[email] Organisation ${booking.orgId} not found`);
      return;
    }

    const [host] = await db
      .select()
      .from(users)
      .where(eq(users.id, booking.organiserId))
      .limit(1);

    if (!host) {
      console.error(`[email] Host user ${booking.organiserId} not found`);
      return;
    }

    // -----------------------------------------------------------------------
    // 2. Format dates in the client's timezone
    // -----------------------------------------------------------------------
    const clientTz = booking.clientTimezone;
    const zonedStart = toZonedTime(booking.startAt, clientTz);
    const dateFormatted = format(zonedStart, 'EEEE, d MMMM yyyy');
    const timeFormatted = format(zonedStart, 'h:mm a');

    // -----------------------------------------------------------------------
    // 3. Build branding values
    // -----------------------------------------------------------------------
    const branding = org.branding as {
      logoUrl?: string;
      primaryColour: string;
      companyName?: string;
    };

    const orgName = branding.companyName || org.name;
    const orgLogoUrl = branding.logoUrl;
    const primaryColour = branding.primaryColour || '#0F7E80';

    // -----------------------------------------------------------------------
    // 4. Generate .ics file content
    // -----------------------------------------------------------------------
    const hostName = host.name || host.email;
    const icsContent = generateIcsFile({
      summary: bookingType.name,
      description: `${bookingType.name} with ${hostName}`,
      startAt: booking.startAt,
      endAt: booking.endAt,
      location: booking.location || bookingType.locationDetails || undefined,
      organiserName: hostName,
      organiserEmail: host.email,
      attendeeName: booking.clientName,
      attendeeEmail: booking.clientEmail,
      uid: `booking-${booking.id}@${new URL(APP_URL).hostname}`,
    });

    // -----------------------------------------------------------------------
    // 5. Build URLs
    // -----------------------------------------------------------------------
    const icsDownloadUrl = `${APP_URL}/api/v1/book/${ctx.orgSlug}/${ctx.typeSlug}/ics/${booking.id}?token=${booking.cancellationToken}`;

    const addToCalendarUrl = buildGoogleCalendarUrl({
      title: bookingType.name,
      startAt: booking.startAt,
      endAt: booking.endAt,
      description: `${bookingType.name} with ${hostName}`,
      location: booking.location || bookingType.locationDetails || undefined,
    });

    const rescheduleUrl = booking.rescheduleToken
      ? `${APP_URL}/book/${ctx.orgSlug}/${ctx.typeSlug}/reschedule?token=${booking.rescheduleToken}`
      : undefined;

    const cancelUrl = booking.cancellationToken
      ? `${APP_URL}/book/${ctx.orgSlug}/${ctx.typeSlug}/cancel?token=${booking.cancellationToken}`
      : undefined;

    const dashboardUrl = `${APP_URL}/dashboard/bookings`;

    // -----------------------------------------------------------------------
    // 6. Send confirmation email to CLIENT
    // -----------------------------------------------------------------------
    await sendEmail({
      to: booking.clientEmail,
      subject: `Booking confirmed: ${bookingType.name} on ${dateFormatted}`,
      react: createElement(ConfirmationEmail, {
        clientName: booking.clientName,
        bookingTypeName: bookingType.name,
        dateFormatted,
        timeFormatted,
        timezone: clientTz,
        durationMins: bookingType.durationMins,
        location: booking.location || bookingType.locationDetails || undefined,
        videoLink: booking.videoLink || undefined,
        hostName,
        addToCalendarUrl,
        icsDownloadUrl,
        rescheduleUrl,
        cancelUrl,
        orgName,
        orgLogoUrl,
        primaryColour,
      }),
      attachments: [
        {
          filename: 'booking.ics',
          content: icsContent,
        },
      ],
    });

    // -----------------------------------------------------------------------
    // 7. Send notification email to HOST
    // -----------------------------------------------------------------------
    const customFieldDefs = (
      bookingType.customFields as { fields: { id: string; type: string; label: string; placeholder?: string; required: boolean; options?: string[] }[] } | null
    )?.fields ?? [];

    const customFieldResponses = (booking.customFieldResponses ?? {}) as Record<
      string,
      string | boolean | string[]
    >;

    const mappedCustomFields = mapCustomFieldResponses(
      customFieldDefs,
      customFieldResponses,
    );

    await sendEmail({
      to: host.email,
      subject: `New booking: ${booking.clientName} booked ${bookingType.name}`,
      react: createElement(NotificationEmail, {
        hostName,
        clientName: booking.clientName,
        clientEmail: booking.clientEmail,
        clientPhone: booking.clientPhone || undefined,
        bookingTypeName: bookingType.name,
        dateFormatted,
        timeFormatted,
        timezone: clientTz,
        durationMins: bookingType.durationMins,
        location: booking.location || bookingType.locationDetails || undefined,
        videoLink: booking.videoLink || undefined,
        notes: booking.notes || undefined,
        customFields: mappedCustomFields.length > 0 ? mappedCustomFields : undefined,
        dashboardUrl,
        orgName,
        orgLogoUrl,
        primaryColour,
      }),
    });

    // -----------------------------------------------------------------------
    // 8. Schedule reminders
    // -----------------------------------------------------------------------
    const now = Date.now();
    const startMs = booking.startAt.getTime();

    // 24-hour reminder (skip if booking starts within 24h)
    const twentyFourHBefore = new Date(startMs - 24 * 60 * 60 * 1000);
    if (twentyFourHBefore.getTime() > now) {
      await scheduleReminder(
        booking.id,
        '24h',
        twentyFourHBefore,
        { type: '24h_reminder', bookingId: booking.id, reminderId: '' },
      );
    }

    // 1-hour reminder (skip if booking starts within 1h)
    const oneHBefore = new Date(startMs - 60 * 60 * 1000);
    if (oneHBefore.getTime() > now) {
      await scheduleReminder(
        booking.id,
        '1h',
        oneHBefore,
        { type: '1h_reminder', bookingId: booking.id, reminderId: '' },
      );
    }

    // Review request (if enabled on booking type)
    const emailSettings = bookingType.emailSettings as EmailSettingsShape | null;

    if (emailSettings?.reviewRequest?.enabled) {
      const reviewSendAt = new Date(
        booking.endAt.getTime() + emailSettings.reviewRequest.delayMinutes * 60 * 1000,
      );
      if (reviewSendAt.getTime() > now) {
        await scheduleReminder(
          booking.id,
          'review_request',
          reviewSendAt,
          { type: 'review_request', bookingId: booking.id, reminderId: '' },
        );
      }
    }

    // Follow-up (if enabled on booking type)
    if (emailSettings?.followUpReminder?.enabled) {
      const followUpSendAt = new Date(
        booking.endAt.getTime() + emailSettings.followUpReminder.delayDays * 24 * 60 * 60 * 1000,
      );
      if (followUpSendAt.getTime() > now) {
        await scheduleReminder(
          booking.id,
          'follow_up',
          followUpSendAt,
          { type: 'follow_up', bookingId: booking.id, reminderId: '' },
        );
      }
    }

    console.log(`[email] All emails sent/scheduled for booking ${booking.id}`);
  } catch (error) {
    console.error('[email] sendBookingEmails failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Helper: insert reminder row, schedule BullMQ job, update row with jobId
// ---------------------------------------------------------------------------

async function scheduleReminder(
  bookingId: string,
  type: '24h' | '1h' | 'review_request' | 'follow_up',
  scheduledAt: Date,
  jobData: { type: string; bookingId: string; reminderId: string },
): Promise<void> {
  try {
    // 1. Insert reminder row
    const [reminder] = await db
      .insert(bookingReminders)
      .values({
        bookingId,
        type,
        scheduledAt,
      })
      .returning({ id: bookingReminders.id });

    // 2. Schedule BullMQ job with the real reminderId
    const enrichedData = { ...jobData, reminderId: reminder.id };
    const job = await scheduleEmailJob(
      enrichedData as Parameters<typeof scheduleEmailJob>[0],
      scheduledAt,
    );

    // 3. Update reminder row with jobId
    if (job) {
      await db
        .update(bookingReminders)
        .set({ jobId: job.id })
        .where(eq(bookingReminders.id, reminder.id));
    }
  } catch (error) {
    console.error(`[email] Failed to schedule ${type} reminder:`, error);
  }
}
