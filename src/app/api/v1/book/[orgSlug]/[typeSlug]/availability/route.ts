import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organisations, bookingTypes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// CORS headers for cross-origin embed widget requests
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
 * GET /api/v1/book/:orgSlug/:typeSlug/availability?date=2026-02-15&timezone=Europe/London
 *
 * Returns available time slots for a given date.
 * Called by the public booking page and embed widget (cross-origin).
 *
 * This is a stub — the availability engine (Phase 1B, step 7) will implement
 * the actual slot calculation. For now it returns the booking type metadata
 * so the public page can render correctly.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; typeSlug: string }> },
) {
  const { orgSlug, typeSlug } = await params;
  const searchParams = request.nextUrl.searchParams;
  const dateParam = searchParams.get('date');
  const timezone = searchParams.get('timezone') ?? 'Europe/London';

  if (!dateParam) {
    return NextResponse.json(
      { error: 'Missing required parameter: date (YYYY-MM-DD)' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD.' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Look up org + booking type
  const org = await db
    .select({ id: organisations.id, name: organisations.name, branding: organisations.branding })
    .from(organisations)
    .where(eq(organisations.slug, orgSlug))
    .limit(1);

  if (org.length === 0) {
    return NextResponse.json(
      { error: 'Organisation not found.' },
      { status: 404, headers: corsHeaders },
    );
  }

  const type = await db
    .select()
    .from(bookingTypes)
    .where(and(eq(bookingTypes.orgId, org[0].id), eq(bookingTypes.slug, typeSlug), eq(bookingTypes.isActive, true)))
    .limit(1);

  if (type.length === 0) {
    return NextResponse.json(
      { error: 'Booking type not found or inactive.' },
      { status: 404, headers: corsHeaders },
    );
  }

  const bookingType = type[0];

  // Availability engine will replace this with real slot calculation.
  // For now, return booking type metadata so the UI can be built.
  return NextResponse.json({
    organisation: {
      name: org[0].name,
      branding: org[0].branding,
    },
    bookingType: {
      id: bookingType.id,
      name: bookingType.name,
      description: bookingType.description,
      durationMins: bookingType.durationMins,
      locationType: bookingType.locationType,
      customFields: bookingType.customFields,
      priceAmount: bookingType.priceAmount,
      priceCurrency: bookingType.priceCurrency,
      requiresPayment: bookingType.requiresPayment,
    },
    date: dateParam,
    timezone,
    // Placeholder — availability engine will populate this
    slots: [],
  }, { headers: corsHeaders });
}
