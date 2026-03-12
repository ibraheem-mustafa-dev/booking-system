import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bookings, bookingTypes, organisations } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/v1/booking/lookup?token=xxx&type=cancel|reschedule
 *
 * Returns booking summary for cancel/reschedule pages. No auth required.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get('token');
  const type = searchParams.get('type');

  if (!token || !type || !['cancel', 'reschedule'].includes(type)) {
    return NextResponse.json(
      { error: 'Missing or invalid parameters.' },
      { status: 400, headers: corsHeaders },
    );
  }

  const tokenColumn = type === 'cancel'
    ? bookings.cancellationToken
    : bookings.rescheduleToken;

  const statusFilter = type === 'cancel'
    ? ne(bookings.status, 'cancelled')
    : eq(bookings.status, 'confirmed');

  const [booking] = await db
    .select({
      id: bookings.id,
      clientName: bookings.clientName,
      clientTimezone: bookings.clientTimezone,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      bookingTypeId: bookings.bookingTypeId,
      orgId: bookings.orgId,
    })
    .from(bookings)
    .where(and(eq(tokenColumn, token), statusFilter))
    .limit(1);

  if (!booking) {
    return NextResponse.json(
      { error: 'Booking not found or not eligible.' },
      { status: 404, headers: corsHeaders },
    );
  }

  const [bookingType] = await db
    .select({
      name: bookingTypes.name,
      slug: bookingTypes.slug,
      durationMins: bookingTypes.durationMins,
      maxAdvanceDays: bookingTypes.maxAdvanceDays,
    })
    .from(bookingTypes)
    .where(eq(bookingTypes.id, booking.bookingTypeId))
    .limit(1);

  const [org] = await db
    .select({ slug: organisations.slug })
    .from(organisations)
    .where(eq(organisations.id, booking.orgId))
    .limit(1);

  return NextResponse.json(
    {
      clientName: booking.clientName,
      bookingTypeName: bookingType?.name ?? 'Booking',
      bookingTypeSlug: bookingType?.slug ?? '',
      durationMins: bookingType?.durationMins ?? 30,
      maxAdvanceDays: bookingType?.maxAdvanceDays ?? 60,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      timezone: booking.clientTimezone,
      orgSlug: org?.slug ?? '',
    },
    { status: 200, headers: corsHeaders },
  );
}
