import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { format, parseISO } from 'date-fns';
import { db } from '@/lib/db';
import {
  invoices,
  organisations,
  users,
  bookings,
  bookingTypes,
} from '@/lib/db/schema';
import { generateInvoicePdf } from '@/lib/invoice/generate';
import type { InvoicePdfProps } from '@/lib/invoice/template';

// ---------------------------------------------------------------------------
// CORS headers (same pattern as other /api/v1/ routes)
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ---------------------------------------------------------------------------
// Branding type (matches JSONB shape on organisations.branding)
// ---------------------------------------------------------------------------

interface OrgBranding {
  logoUrl?: string;
  primaryColour: string;
  accentColour: string;
  companyName?: string;
  companyAddress?: string;
  vatNumber?: string;
  companyRegistrationNumber?: string;
  terms?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateDDMMYYYY(dateStr: string): string {
  const parsed = parseISO(dateStr);
  return format(parsed, 'dd/MM/yyyy');
}

// ---------------------------------------------------------------------------
// GET /api/v1/invoices/:id/pdf?token=<downloadToken>
//
// Public endpoint — authenticates via downloadToken, not session cookie.
// Used by email links and the WordPress plugin.
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Missing token parameter.' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Load invoice — verified by both ID and downloadToken
  const invoiceResult = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, id),
        eq(invoices.downloadToken, token),
      ),
    )
    .limit(1);

  if (invoiceResult.length === 0) {
    return NextResponse.json(
      { error: 'Invoice not found or invalid token.' },
      { status: 404, headers: corsHeaders },
    );
  }

  const invoice = invoiceResult[0];

  // Load the organisation (with branding)
  const orgResult = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, invoice.orgId))
    .limit(1);

  if (orgResult.length === 0) {
    return NextResponse.json(
      { error: 'Organisation not found.' },
      { status: 404, headers: corsHeaders },
    );
  }

  const org = orgResult[0];
  const branding = org.branding as OrgBranding;

  // Load org owner for contact email
  const ownerResult = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, org.ownerId))
    .limit(1);

  const ownerEmail = ownerResult[0]?.email ?? '';

  // Build booking reference and supply date if linked
  let bookingReference: string | undefined;
  let supplyDate: string | undefined;

  if (invoice.bookingId) {
    const bookingResult = await db
      .select({
        startAt: bookings.startAt,
        bookingTypeName: bookingTypes.name,
      })
      .from(bookings)
      .leftJoin(bookingTypes, eq(bookings.bookingTypeId, bookingTypes.id))
      .where(eq(bookings.id, invoice.bookingId))
      .limit(1);

    if (bookingResult.length > 0) {
      const booking = bookingResult[0];
      bookingReference = `${booking.bookingTypeName ?? 'Booking'} — ${format(booking.startAt, 'dd/MM/yyyy HH:mm')}`;
      supplyDate = format(booking.startAt, 'dd/MM/yyyy');
    }
  }

  // Line items from JSONB
  const lineItems = (invoice.lineItems ?? []) as {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];

  // Build PDF props
  const pdfProps: InvoicePdfProps = {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: formatDateDDMMYYYY(invoice.createdAt.toISOString().slice(0, 10)),
    dueDate: formatDateDDMMYYYY(invoice.dueDate),
    supplyDate,

    orgName: org.name,
    companyName: branding.companyName,
    companyAddress: branding.companyAddress,
    vatNumber: branding.vatNumber,
    companyRegistrationNumber: branding.companyRegistrationNumber,
    contactEmail: ownerEmail,
    logoUrl: branding.logoUrl,
    primaryColour: branding.primaryColour,
    accentColour: branding.accentColour,

    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,

    lineItems,
    subtotal: parseFloat(invoice.subtotal),
    vatRate: parseFloat(invoice.vatRate ?? '0'),
    vatAmount: parseFloat(invoice.vatAmount ?? '0'),
    total: parseFloat(invoice.total),
    currency: invoice.currency,
    paymentStatus: invoice.paymentStatus,

    notes: invoice.notes || undefined,
    terms: branding.terms,
    bookingReference,
  };

  // Generate the PDF
  const pdfBuffer = await generateInvoicePdf(pdfProps);

  // Return the PDF as a download — convert Buffer to Uint8Array for NextResponse
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'private, no-cache',
    },
  });
}
