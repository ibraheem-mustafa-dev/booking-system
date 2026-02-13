import { config } from 'dotenv';
config({ path: '.env.local' });

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '@/lib/queue/connection';
import { EmailJobData } from '@/lib/queue/email';
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
import { replacePlaceholders } from '@/lib/email/helpers';
import { ReminderEmail } from '@/lib/email/templates/reminder';
import { ReviewRequestEmail } from '@/lib/email/templates/review-request';
import { FollowUpEmail } from '@/lib/email/templates/follow-up';
import { createElement } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const data = job.data;
  console.log(`[worker] Processing job ${job.id} (${data.type})`);

  // -------------------------------------------------------------------------
  // 1. Load booking context
  // -------------------------------------------------------------------------
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, data.bookingId))
    .limit(1);

  if (!booking) {
    console.error(`[worker] Booking ${data.bookingId} not found, skipping`);
    return;
  }

  // Skip cancelled bookings
  if (booking.status === 'cancelled') {
    console.log(`[worker] Booking ${data.bookingId} is cancelled, skipping`);
    return;
  }

  const [bookingType] = await db
    .select()
    .from(bookingTypes)
    .where(eq(bookingTypes.id, booking.bookingTypeId))
    .limit(1);

  if (!bookingType) {
    console.error(`[worker] BookingType ${booking.bookingTypeId} not found, skipping`);
    return;
  }

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, booking.orgId))
    .limit(1);

  if (!org) {
    console.error(`[worker] Organisation ${booking.orgId} not found, skipping`);
    return;
  }

  const [host] = await db
    .select()
    .from(users)
    .where(eq(users.id, booking.organiserId))
    .limit(1);

  if (!host) {
    console.error(`[worker] Host user ${booking.organiserId} not found, skipping`);
    return;
  }

  // -------------------------------------------------------------------------
  // 2. Format dates in client's timezone
  // -------------------------------------------------------------------------
  const clientTz = booking.clientTimezone;
  const zonedStart = toZonedTime(booking.startAt, clientTz);
  const dateFormatted = format(zonedStart, 'EEEE, d MMMM yyyy');
  const timeFormatted = format(zonedStart, 'h:mm a');

  // -------------------------------------------------------------------------
  // 3. Build branding values
  // -------------------------------------------------------------------------
  const branding = org.branding as {
    logoUrl?: string;
    primaryColour: string;
    companyName?: string;
  };

  const orgName = branding.companyName || org.name;
  const orgLogoUrl = branding.logoUrl;
  const primaryColour = branding.primaryColour || '#1B6B6B';
  const hostName = host.name || host.email;

  // -------------------------------------------------------------------------
  // 4. Build URLs (needed for reminder emails)
  // -------------------------------------------------------------------------
  // We need the org slug and type slug for URL building
  const orgSlug = org.slug;
  const typeSlug = bookingType.slug;

  const icsDownloadUrl = `${APP_URL}/api/v1/book/${orgSlug}/${typeSlug}/ics/${booking.id}?token=${booking.cancellationToken}`;

  const addToCalendarUrl = buildGoogleCalendarUrl({
    title: bookingType.name,
    startAt: booking.startAt,
    endAt: booking.endAt,
    description: `${bookingType.name} with ${hostName}`,
    location: booking.location || bookingType.locationDetails || undefined,
  });

  const rescheduleUrl = booking.rescheduleToken
    ? `${APP_URL}/book/${orgSlug}/${typeSlug}/reschedule?token=${booking.rescheduleToken}`
    : undefined;

  const cancelUrl = booking.cancellationToken
    ? `${APP_URL}/book/${orgSlug}/${typeSlug}/cancel?token=${booking.cancellationToken}`
    : undefined;

  // -------------------------------------------------------------------------
  // 5. Process by job type
  // -------------------------------------------------------------------------
  switch (data.type) {
    case '24h_reminder':
    case '1h_reminder': {
      const reminderType = data.type === '24h_reminder' ? '24h' : '1h';

      await sendEmail({
        to: booking.clientEmail,
        subject: `Reminder: ${bookingType.name} ${reminderType === '24h' ? 'tomorrow' : 'in 1 hour'}`,
        react: createElement(ReminderEmail, {
          reminderType,
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
      });

      // Mark reminder as sent
      if (data.reminderId) {
        await db
          .update(bookingReminders)
          .set({ sentAt: new Date() })
          .where(eq(bookingReminders.id, data.reminderId));
      }

      console.log(`[worker] Sent ${reminderType} reminder for booking ${booking.id}`);
      break;
    }

    case 'review_request': {
      const emailSettings = bookingType.emailSettings as EmailSettingsShape | null;
      if (!emailSettings?.reviewRequest) {
        console.log(`[worker] Review request settings missing, skipping`);
        return;
      }

      const placeholderValues: Record<string, string> = {
        clientName: booking.clientName,
        bookingType: bookingType.name,
        bookingDate: dateFormatted,
        hostName,
        orgName,
      };

      const subject = replacePlaceholders(
        emailSettings.reviewRequest.subject,
        placeholderValues,
      );

      const bodyMarkdown = replacePlaceholders(
        emailSettings.reviewRequest.body,
        placeholderValues,
      );

      await sendEmail({
        to: booking.clientEmail,
        subject,
        react: createElement(ReviewRequestEmail, {
          clientName: booking.clientName,
          bodyMarkdown,
          orgName,
          orgLogoUrl,
          primaryColour,
        }),
      });

      // Mark reminder as sent
      if (data.reminderId) {
        await db
          .update(bookingReminders)
          .set({ sentAt: new Date() })
          .where(eq(bookingReminders.id, data.reminderId));
      }

      console.log(`[worker] Sent review request for booking ${booking.id}`);
      break;
    }

    case 'follow_up': {
      const followUpSettings = bookingType.emailSettings as EmailSettingsShape | null;
      if (!followUpSettings?.followUpReminder) {
        console.log(`[worker] Follow-up settings missing, skipping`);
        return;
      }

      const placeholderValues: Record<string, string> = {
        clientName: booking.clientName,
        bookingType: bookingType.name,
        bookingDate: dateFormatted,
        hostName,
        orgName,
      };

      const subject = replacePlaceholders(
        followUpSettings.followUpReminder.subject,
        placeholderValues,
      );

      const bodyMarkdown = replacePlaceholders(
        followUpSettings.followUpReminder.body,
        placeholderValues,
      );

      const bookingLink = `${APP_URL}/book/${orgSlug}/${typeSlug}`;

      await sendEmail({
        to: booking.clientEmail,
        subject,
        react: createElement(FollowUpEmail, {
          clientName: booking.clientName,
          bodyMarkdown,
          bookingLink,
          orgName,
          orgLogoUrl,
          primaryColour,
        }),
      });

      // Mark reminder as sent
      if (data.reminderId) {
        await db
          .update(bookingReminders)
          .set({ sentAt: new Date() })
          .where(eq(bookingReminders.id, data.reminderId));
      }

      console.log(`[worker] Sent follow-up for booking ${booking.id}`);
      break;
    }

    default: {
      console.warn(`[worker] Unknown job type: ${(data as EmailJobData).type}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Worker setup
// ---------------------------------------------------------------------------

const worker = new Worker<EmailJobData>('email', processEmailJob, {
  connection: getRedisConnection(),
  concurrency: 5,
});

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[worker] Worker error:', err);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown() {
  console.log('[worker] Shutting down...');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[worker] Email worker started, waiting for jobs...');
