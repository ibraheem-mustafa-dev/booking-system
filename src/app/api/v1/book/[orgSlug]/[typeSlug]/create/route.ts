import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organisations, bookingTypes, bookings, invoices, users } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { createElement } from 'react';
import { z } from 'zod';
import { format } from 'date-fns';
import { loadAvailability } from '@/lib/availability/loader';
import { sendBookingEmails } from '@/lib/email/send-booking-emails';
import { parseInvoiceNumber, formatInvoiceNumber } from '@/lib/invoice/number';
import { generateInvoicePdf } from '@/lib/invoice/generate';
import { sendEmail } from '@/lib/email/resend';
import { InvoiceEmail } from '@/lib/email/templates/invoice-email';

// IANA timezone validation — cached set for performance
const VALID_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

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
  clientTimezone: z.string().min(1, 'Timezone is required').max(64).refine(
    (tz) => VALID_TIMEZONES.has(tz),
    { message: 'Invalid timezone. Use an IANA timezone such as Europe/London.' },
  ),
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

  // Look up org + booking type (select full row — branding needed for invoice)
  const [org] = await db
    .select()
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

  // Auto-create invoice for paid booking types
  if (type.requiresPayment && type.priceAmount) {
    try {
      const priceNum = parseFloat(type.priceAmount);
      const lineItems = [
        {
          description: type.name,
          quantity: 1,
          unitPrice: priceNum,
          total: priceNum,
        },
      ];

      // Generate next invoice number for this org
      const maxResult = await db
        .select({ maxNum: sql<string | null>`max(${invoices.invoiceNumber})` })
        .from(invoices)
        .where(eq(invoices.orgId, org.id));

      const currentMax = maxResult[0]?.maxNum ?? null;
      const nextSeq = parseInvoiceNumber(currentMax) + 1;
      const invoiceNumber = formatInvoiceNumber(nextSeq);

      const downloadToken = randomBytes(32).toString('hex');
      const dueDate = format(new Date(), 'yyyy-MM-dd');

      const [newInvoice] = await db
        .insert(invoices)
        .values({
          orgId: org.id,
          bookingId: booking.id,
          invoiceNumber,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          lineItems,
          subtotal: priceNum.toFixed(2),
          vatRate: '0.00',
          vatAmount: '0.00',
          total: priceNum.toFixed(2),
          dueDate,
          downloadToken,
        })
        .returning();

      // Send invoice email async (fire-and-forget)
      (async () => {
        try {
          const branding = org.branding as {
            logoUrl?: string;
            primaryColour: string;
            accentColour: string;
            companyName?: string;
            terms?: string;
          };

          // Get org owner email
          const ownerResult = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, org.ownerId))
            .limit(1);

          const ownerEmail = ownerResult[0]?.email ?? '';
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
          const downloadUrl = `${appUrl}/api/v1/invoices/${newInvoice.id}/pdf?token=${downloadToken}`;

          const currencySymbol = newInvoice.currency === 'GBP' ? '\u00a3' : newInvoice.currency === 'EUR' ? '\u20ac' : '$';
          const totalFormatted = `${currencySymbol}${priceNum.toFixed(2)}`;

          await sendEmail({
            to: input.clientEmail,
            subject: `Invoice ${invoiceNumber} from ${org.name}`,
            react: createElement(InvoiceEmail, {
              clientName: input.clientName,
              invoiceNumber,
              invoiceDate: format(new Date(), 'd MMMM yyyy'),
              dueDate: format(new Date(), 'd MMMM yyyy'),
              totalFormatted,
              paymentStatus: 'pending',
              downloadUrl,
              bookingTypeName: type.name,
              bookingDateFormatted: format(startDate, 'd MMMM yyyy'),
              terms: branding.terms,
              contactEmail: ownerEmail,
              orgName: org.name,
              orgLogoUrl: branding.logoUrl,
              primaryColour: branding.primaryColour,
            }),
            attachments: [
              {
                filename: `${invoiceNumber}.pdf`,
                content: await generateInvoicePdf({
                  invoiceNumber,
                  invoiceDate: format(new Date(), 'dd/MM/yyyy'),
                  dueDate: format(new Date(), 'dd/MM/yyyy'),
                  supplyDate: format(startDate, 'dd/MM/yyyy'),
                  orgName: org.name,
                  companyName: branding.companyName,
                  contactEmail: ownerEmail,
                  primaryColour: branding.primaryColour,
                  accentColour: branding.accentColour,
                  clientName: input.clientName,
                  clientEmail: input.clientEmail,
                  lineItems,
                  subtotal: priceNum,
                  vatRate: 0,
                  vatAmount: 0,
                  total: priceNum,
                  currency: newInvoice.currency,
                  paymentStatus: 'pending',
                  bookingReference: `${type.name} — ${format(startDate, 'dd/MM/yyyy HH:mm')}`,
                }),
              },
            ],
          });
        } catch (emailErr) {
          console.error('[booking] Invoice email failed:', emailErr);
        }
      })();
    } catch (err) {
      // Invoice creation is best-effort — don't fail the booking
      console.error('[booking] Invoice auto-creation failed:', err);
    }
  }

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
