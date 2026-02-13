import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bookings, bookingTypes, organisations, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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
 * GET /api/v1/book/:orgSlug/:typeSlug/ics/:bookingId
 *
 * Returns a downloadable .ics calendar file for the given booking.
 * No authentication required — the booking ID acts as an unguessable token.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; typeSlug: string; bookingId: string }> },
) {
  const { bookingId } = await params;

  // Load booking
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
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
