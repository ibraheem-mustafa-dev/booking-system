import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, organisations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/v1/invoices/:id/public
 *
 * Public endpoint for clients to view their invoice (no auth).
 * Returns invoice data with org branding for the payment page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    return NextResponse.json(
      { error: 'Invoice not found.' },
      { status: 404 },
    );
  }

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, invoice.orgId))
    .limit(1);

  const branding = (org?.branding ?? {}) as {
    logoUrl?: string;
    primaryColour?: string;
    companyName?: string;
  };

  return NextResponse.json({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    lineItems: invoice.lineItems,
    subtotal: invoice.subtotal,
    vatRate: invoice.vatRate,
    vatAmount: invoice.vatAmount,
    total: invoice.total,
    currency: invoice.currency,
    paymentStatus: invoice.paymentStatus,
    dueDate: invoice.dueDate,
    orgName: branding.companyName || org?.name || '',
    orgLogoUrl: branding.logoUrl,
    primaryColour: branding.primaryColour || '#0F7E80',
  });
}
