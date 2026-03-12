import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/invoices/:id/checkout
 *
 * Creates a Stripe Checkout Session for an unpaid invoice.
 * No auth required - this is called from the client-facing invoice page.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Online payments are not configured.' },
      { status: 503 },
    );
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, id),
        eq(invoices.paymentStatus, 'pending'),
      ),
    )
    .limit(1);

  if (!invoice) {
    return NextResponse.json(
      { error: 'Invoice not found or already paid.' },
      { status: 404 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const totalInPence = Math.round(parseFloat(invoice.total) * 100);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: invoice.currency.toLowerCase(),
          product_data: {
            name: `Invoice ${invoice.invoiceNumber}`,
            description: `Payment for ${invoice.clientName}`,
          },
          unit_amount: totalInPence,
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: invoice.id,
    },
    customer_email: invoice.clientEmail,
    success_url: `${appUrl}/invoice/${invoice.id}/paid`,
    cancel_url: `${appUrl}/invoice/${invoice.id}`,
  });

  // Store the checkout session ID
  await db
    .update(invoices)
    .set({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoice.id));

  return NextResponse.json({ url: session.url });
}
