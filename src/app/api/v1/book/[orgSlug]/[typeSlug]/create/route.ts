import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organisations, bookingTypes, bookings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { loadAvailability } from '@/lib/availability/loader';
import { sendBookingEmails } from '@/lib/email/send-booking-emails';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const createBookingSchema = z.object({
  clientName: z.string().min(1, 'Name is required').max(256),
  clientEmail: z.string().email('Valid email is required').max(320),
  clientPhone: z.string().max(32).optional(),
  clientTimezone: z.string().min(1, 'Timezone is required').max(64),
  startAt: z.string().datetime({ message: 'startAt must be an ISO 8601 date' }),
  notes: z.string().max(2000).optional(),
  customFieldResponses: z.record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string())])).optional(),
});

/**
 * POST /api/v1/book/:orgSlug/:typeSlug/create
 *
 * Creates a new booking. Validates the chosen slot is still available.
 * No authentication required — this is the public booking endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; typeSlug: string }> },
) {
  const { orgSlug, typeSlug } = await params;

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400, headers: corsHeaders },
    );
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400, headers: corsHeaders },
    );
  }

  const input = parsed.data;
  const startDate = new Date(input.startAt);

  // Look up org + booking type
  const [org] = await db
    .select({ id: organisations.id, ownerId: organisations.ownerId })
    .from(organisations)
    .where(eq(organisations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return NextResponse.json(
      { error: 'Organisation not found.' },
      { status: 404, headers: corsHeaders },
    );
  }

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
    return NextResponse.json(
      { error: 'Booking type not found or inactive.' },
      { status: 404, headers: corsHeaders },
    );
  }

  // Verify the chosen slot is still available
  const dateStr = startDate.toISOString().split('T')[0];
  const availability = await loadAvailability({
    orgSlug,
    typeSlug,
    date: dateStr,
    timezone: input.clientTimezone,
  });

  if ('error' in availability) {
    return NextResponse.json(
      { error: availability.error },
      { status: availability.status, headers: corsHeaders },
    );
  }

  const slotIsAvailable = availability.slots.some(
    (slot) => slot.start.getTime() === startDate.getTime(),
  );

  if (!slotIsAvailable) {
    return NextResponse.json(
      { error: 'This time slot is no longer available. Please choose another.' },
      { status: 409, headers: corsHeaders },
    );
  }

  // Calculate end time
  const endDate = new Date(startDate.getTime() + type.durationMins * 60 * 1000);

  // Generate unique tokens for cancel/reschedule links
  const cancellationToken = randomBytes(32).toString('hex');
  const rescheduleToken = randomBytes(32).toString('hex');

  // Insert the booking
  const [booking] = await db
    .insert(bookings)
    .values({
      orgId: org.id,
      bookingTypeId: type.id,
      organiserId: org.ownerId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      clientPhone: input.clientPhone || null,
      clientTimezone: input.clientTimezone,
      startAt: startDate,
      endAt: endDate,
      notes: input.notes || null,
      customFieldResponses: (input.customFieldResponses || {}) as Record<string, string | boolean | string[]>,
      cancellationToken,
      rescheduleToken,
    })
    .returning({
      id: bookings.id,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
    });

  // Send emails asynchronously — don't await to avoid slowing the booking response
  sendBookingEmails({
    bookingId: booking.id,
    orgSlug,
    typeSlug,
  }).catch((err) => {
    console.error('[booking] Email sending failed:', err);
  });

  return NextResponse.json(
    {
      id: booking.id,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      cancellationToken,
      rescheduleToken,
      message: 'Booking confirmed.',
    },
    { status: 201, headers: corsHeaders },
  );
}
