import { NextRequest, NextResponse } from 'next/server';
import { loadAvailability } from '@/lib/availability/loader';

// IANA timezone validation — cached set for performance
const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD.' },
      { status: 400, headers: corsHeaders },
    );
  }

  if (!VALID_TIMEZONES.has(timezone)) {
    return NextResponse.json(
      { error: 'Invalid timezone. Use an IANA timezone such as Europe/London.' },
      { status: 400, headers: corsHeaders },
    );
  }

  const result = await loadAvailability({
    orgSlug,
    typeSlug,
    date: dateParam,
    timezone,
  });

  if ('error' in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    {
      organisation: {
        name: result.organisation.name,
        branding: result.organisation.branding,
      },
      bookingType: result.bookingType,
      date: dateParam,
      timezone,
      slots: result.slots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
      })),
    },
    { headers: corsHeaders },
  );
}
