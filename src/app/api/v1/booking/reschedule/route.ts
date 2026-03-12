import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  bookings,
  bookingTypes,
  users,
  organisations,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { loadAvailability } from '@/lib/availability/loader';
import { sendEmail } from '@/lib/email/resend';
import { createElement } from 'react';
import { ConfirmationEmail } from '@/lib/email/templates/confirmation';
import { NotificationEmail } from '@/lib/email/templates/notification';
import { generateIcsFile } from '@/lib/calendar/ics';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

const rescheduleSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  startAt: z.string().datetime({ message: 'startAt must be an ISO 8601 date' }),
  timezone: z.string().min(1).refine(
    (tz) => VALID_TIMEZONES.has(tz),
    { message: 'Invalid timezone.' },
  ),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400, headers: corsHeaders },
    );
  }

  const parsed = rescheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400, headers: corsHeaders },
    );
  }

  const { token, startAt: startAtIso, timezone } = parsed.data;

  // Find booking by reschedule token (must be confirmed)
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.rescheduleToken, token))
    .limit(1);

  if (!booking || booking.status !== 'confirmed') {
    return NextResponse.json(
      { error: 'Booking not found or cannot be rescheduled.' },
      { status: 404, headers: corsHeaders },
    );
  }

  // Load booking type for duration
  const [bookingType] = await db
    .select()
    .from(bookingTypes)
    .where(eq(bookingTypes.id, booking.bookingTypeId))
    .limit(1);

  if (!bookingType) {
    return NextResponse.json(
      { error: 'Booking type not found.' },
      { status: 404, headers: corsHeaders },
    );
  }

  // Load org for slug
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, booking.orgId))
    .limit(1);

  if (!org) {
    return NextResponse.json(
      { error: 'Organisation not found.' },
      { status: 404, headers: corsHeaders },
    );
  }

  const newStartAt = new Date(startAtIso);
  const dateStr = newStartAt.toISOString().split('T')[0];

  // Validate the new slot is available
  const availability = await loadAvailability({
    orgSlug: org.slug,
    typeSlug: bookingType.slug,
    date: dateStr,
    timezone,
  });

  if ('error' in availability) {
    return NextResponse.json(
      { error: availability.error },
      { status: availability.status, headers: corsHeaders },
    );
  }

  const slotIsAvailable = availability.slots.some(
    (slot) => slot.start.getTime() === newStartAt.getTime(),
  );

  if (!slotIsAvailable) {
    return NextResponse.json(
      { error: 'This time slot is no longer available. Please choose another.' },
      { status: 409, headers: corsHeaders },
    );
  }

  const newEndAt = new Date(newStartAt.getTime() + bookingType.durationMins * 60 * 1000);

  // Update booking times
  await db
    .update(bookings)
    .set({
      startAt: newStartAt,
      endAt: newEndAt,
      clientTimezone: timezone,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id));

  // Update Google Calendar event if present
  if (booking.googleCalendarEventId) {
    void (async () => {
      try {
        const { updateBookingEvent } = await import('@/lib/calendar/google');
        await updateBookingEvent(booking.googleCalendarEventId!, {
          startAt: newStartAt,
          endAt: newEndAt,
        });
      } catch {
        // Calendar update is best-effort
      }
    })();
  }

  // Send updated confirmation emails (fire-and-forget)
  void (async () => {
    try {
      const [host] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, booking.organiserId))
        .limit(1);

      if (!host) return;

      const branding = org.branding as {
        logoUrl?: string;
        primaryColour: string;
        companyName?: string;
      };

      const orgName = branding.companyName || org.name;
      const hostName = host.name || host.email;
      const clientTz = timezone;
      const zonedStart = toZonedTime(newStartAt, clientTz);
      const dateFormatted = format(zonedStart, 'EEEE, d MMMM yyyy');
      const timeFormatted = format(zonedStart, 'h:mm a');

      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const icsContent = generateIcsFile({
        summary: bookingType.name,
        description: `${bookingType.name} with ${hostName}`,
        startAt: newStartAt,
        endAt: newEndAt,
        location: booking.location || bookingType.locationDetails || undefined,
        organiserName: hostName,
        organiserEmail: host.email,
        attendeeName: booking.clientName,
        attendeeEmail: booking.clientEmail,
        uid: `booking-${booking.id}@${new URL(APP_URL).hostname}`,
      });

      const rescheduleUrl = booking.rescheduleToken
        ? `${APP_URL}/book/reschedule?token=${booking.rescheduleToken}`
        : undefined;
      const cancelUrl = booking.cancellationToken
        ? `${APP_URL}/book/cancel?token=${booking.cancellationToken}`
        : undefined;

      // Build Google Calendar add URL
      const formatGcal = (d: Date) =>
        d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const gcalUrl = new URL('https://calendar.google.com/calendar/render');
      gcalUrl.searchParams.set('action', 'TEMPLATE');
      gcalUrl.searchParams.set('text', bookingType.name);
      gcalUrl.searchParams.set('dates', `${formatGcal(newStartAt)}/${formatGcal(newEndAt)}`);

      const addToCalendarUrl = gcalUrl.toString();
      const icsDownloadUrl = `${APP_URL}/api/v1/book/${org.slug}/${bookingType.slug}/ics/${booking.id}?token=${booking.cancellationToken}`;

      // Send updated confirmation to client
      await sendEmail({
        to: booking.clientEmail,
        subject: `Booking rescheduled: ${bookingType.name} on ${dateFormatted}`,
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
          orgLogoUrl: branding.logoUrl,
          primaryColour: branding.primaryColour,
        }),
        attachments: [
          {
            filename: 'booking.ics',
            content: icsContent,
          },
        ],
      });

      // Send notification to host
      await sendEmail({
        to: host.email,
        subject: `Booking rescheduled: ${booking.clientName} moved ${bookingType.name} to ${dateFormatted}`,
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
          dashboardUrl: `${APP_URL}/dashboard/bookings`,
          orgName,
          orgLogoUrl: branding.logoUrl,
          primaryColour: branding.primaryColour,
        }),
      });
    } catch (err) {
      console.error('[reschedule] Email sending failed:', err);
    }
  })();

  return NextResponse.json(
    { success: true },
    { status: 200, headers: corsHeaders },
  );
}
