import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bookings, bookingTypes, users, organisations } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { sendEmail } from '@/lib/email/resend';
import { createElement } from 'react';
import { CancellationEmail } from '@/lib/email/templates/cancellation';
import { CancellationNotificationEmail } from '@/lib/email/templates/cancellation-notification';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const cancelSchema = z.object({
  token: z.string().min(1, 'Token is required'),
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

  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400, headers: corsHeaders },
    );
  }

  const { token } = parsed.data;

  // Find booking by cancellation token (not already cancelled)
  const [booking] = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.cancellationToken, token),
        ne(bookings.status, 'cancelled'),
      ),
    )
    .limit(1);

  if (!booking) {
    return NextResponse.json(
      { error: 'Booking not found or already cancelled.' },
      { status: 404, headers: corsHeaders },
    );
  }

  // Check if booking is in the past
  if (booking.startAt < new Date()) {
    return NextResponse.json(
      { error: 'Cannot cancel a booking that has already passed.' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Update status to cancelled
  await db
    .update(bookings)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id));

  // Load related data for emails (fire-and-forget)
  void (async () => {
    try {
      const [bookingType] = await db
        .select({ name: bookingTypes.name })
        .from(bookingTypes)
        .where(eq(bookingTypes.id, booking.bookingTypeId))
        .limit(1);

      const [host] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, booking.organiserId))
        .limit(1);

      const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, booking.orgId))
        .limit(1);

      if (!bookingType || !host || !org) return;

      const branding = org.branding as {
        logoUrl?: string;
        primaryColour: string;
        companyName?: string;
      };
      const orgName = branding.companyName || org.name;
      const hostName = host.name || host.email;

      const clientTz = booking.clientTimezone;
      const zonedStart = toZonedTime(booking.startAt, clientTz);
      const dateFormatted = format(zonedStart, 'EEEE, d MMMM yyyy');
      const timeFormatted = format(zonedStart, 'h:mm a');

      // Send cancellation confirmation to client
      await sendEmail({
        to: booking.clientEmail,
        subject: `Booking cancelled: ${bookingType.name} on ${dateFormatted}`,
        react: createElement(CancellationEmail, {
          clientName: booking.clientName,
          bookingTypeName: bookingType.name,
          dateFormatted,
          timeFormatted,
          timezone: clientTz,
          hostName,
          orgName,
          orgLogoUrl: branding.logoUrl,
          primaryColour: branding.primaryColour,
        }),
      });

      // Send notification to host
      await sendEmail({
        to: host.email,
        subject: `Booking cancelled: ${booking.clientName} cancelled ${bookingType.name}`,
        react: createElement(CancellationNotificationEmail, {
          hostName,
          clientName: booking.clientName,
          clientEmail: booking.clientEmail,
          bookingTypeName: bookingType.name,
          dateFormatted,
          timeFormatted,
          timezone: clientTz,
          orgName,
          orgLogoUrl: branding.logoUrl,
          primaryColour: branding.primaryColour,
        }),
      });
    } catch (err) {
      console.error('[cancel] Email sending failed:', err);
    }
  })();

  // Delete Google Calendar event if present
  if (booking.googleCalendarEventId) {
    void (async () => {
      try {
        const { deleteBookingEvent } = await import('@/lib/calendar/google');
        await deleteBookingEvent(booking.googleCalendarEventId!);
      } catch {
        // Calendar deletion is best-effort
      }
    })();
  }

  return NextResponse.json(
    { success: true },
    { status: 200, headers: corsHeaders },
  );
}
