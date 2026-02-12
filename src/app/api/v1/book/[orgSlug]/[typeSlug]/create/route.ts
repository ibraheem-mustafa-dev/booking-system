import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organisations, bookingTypes, bookings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/v1/book/:orgSlug/:typeSlug/create
 *
 * Creates a new booking. Called by the public booking page and embed widget.
 * No authentication required — this is the public booking endpoint.
 *
 * Request body:
 * {
 *   "clientName": "Jane Smith",
 *   "clientEmail": "jane@example.com",
 *   "clientPhone": "+447700900000",
 *   "clientTimezone": "Europe/London",
 *   "startAt": "2026-02-15T14:00:00Z",
 *   "notes": "Looking forward to it",
 *   "customFieldResponses": { "fieldId1": "value1" }
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; typeSlug: string }> },
) {
  const { orgSlug, typeSlug } = await params;

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400, headers: corsHeaders },
    );
  }

  const { clientName, clientEmail, clientPhone, clientTimezone, startAt, notes, customFieldResponses } = body as {
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    clientTimezone?: string;
    startAt?: string;
    notes?: string;
    customFieldResponses?: Record<string, string | boolean | string[]>;
  };

  // Basic validation — Zod schemas will replace this when building the form
  if (!clientName || !clientEmail || !clientTimezone || !startAt) {
    return NextResponse.json(
      { error: 'Missing required fields: clientName, clientEmail, clientTimezone, startAt' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Look up org + booking type
  const org = await db
    .select({ id: organisations.id })
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

  // Calculate end time from duration
  const startDate = new Date(startAt);
  if (isNaN(startDate.getTime())) {
    return NextResponse.json(
      { error: 'Invalid startAt date format. Use ISO 8601.' },
      { status: 400, headers: corsHeaders },
    );
  }
  const endDate = new Date(startDate.getTime() + bookingType.durationMins * 60 * 1000);

  // Generate unique tokens for cancel/reschedule links
  const cancellationToken = randomBytes(32).toString('hex');
  const rescheduleToken = randomBytes(32).toString('hex');

  // TODO: Before inserting, the availability engine must verify the slot is still open.
  // This requires a SELECT ... FOR UPDATE within a transaction to prevent race conditions.
  // Implementing in Phase 1B (step 7) alongside the availability engine.

  // Find the organiser (org owner for now — team routing comes in Phase 2)
  const orgOwner = await db
    .select({ ownerId: organisations.ownerId })
    .from(organisations)
    .where(eq(organisations.id, org[0].id))
    .limit(1);

  const [booking] = await db
    .insert(bookings)
    .values({
      orgId: org[0].id,
      bookingTypeId: bookingType.id,
      organiserId: orgOwner[0].ownerId,
      clientName,
      clientEmail,
      clientPhone: clientPhone ?? null,
      clientTimezone,
      startAt: startDate,
      endAt: endDate,
      notes: notes ?? null,
      customFieldResponses: customFieldResponses ?? {},
      cancellationToken,
      rescheduleToken,
    })
    .returning({ id: bookings.id, startAt: bookings.startAt, endAt: bookings.endAt });

  // TODO: Trigger confirmation email + schedule reminders via BullMQ (Phase 1B, step 9)

  return NextResponse.json({
    id: booking.id,
    startAt: booking.startAt,
    endAt: booking.endAt,
    cancellationToken,
    rescheduleToken,
    message: 'Booking confirmed.',
  }, { status: 201, headers: corsHeaders });
}
