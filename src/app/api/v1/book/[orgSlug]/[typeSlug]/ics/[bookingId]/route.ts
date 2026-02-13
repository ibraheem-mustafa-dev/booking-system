import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bookings, bookingTypes, organisations, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateIcsFile } from '@/lib/calendar/ics';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/v1/book/:orgSlug/:typeSlug/ics/:bookingId?token=...
 *
 * Returns a downloadable .ics calendar file for the given booking.
 * Requires a valid cancellation token to prevent PII leakage.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; typeSlug: string; bookingId: string }> },
) {
  const { bookingId } = await params;
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Missing required parameter: token' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Load booking and verify token in a single query
  const [booking] = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.cancellationToken, token),
      ),
    )
    .limit(1);

  if (!booking) {
    return NextResponse.json(
      { error: 'Booking not found.' },
      { status: 404, headers: corsHeaders },
    );
  }

  // Load booking type
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

  // Load organisation
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

  // Load host user
  const [host] = await db
    .select()
    .from(users)
    .where(eq(users.id, booking.organiserId))
    .limit(1);

  if (!host) {
    return NextResponse.json(
      { error: 'Host not found.' },
      { status: 404, headers: corsHeaders },
    );
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const hostName = host.name || host.email;

  // Generate .ics content
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

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="booking.ics"',
    },
  });
}
