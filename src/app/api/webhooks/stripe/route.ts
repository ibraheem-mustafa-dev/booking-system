import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events.
 * Verifies signature if STRIPE_WEBHOOK_SECRET is set.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();

  // If Stripe is not configured, accept silently
  if (!stripe) {
    console.log('[stripe-webhook] Stripe not configured, ignoring');
    return NextResponse.json({ received: true });
  }

  const rawBody = await request.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (webhookSecret) {
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header.' },
        { status: 400 },
      );
    }

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error('[stripe-webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed.' },
        { status: 400 },
      );
    }
  } else {
    // No webhook secret - parse event without verification (dev only)
    console.warn('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set, skipping verification');
    try {
      event = JSON.parse(rawBody) as Stripe.Event;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON.' },
        { status: 400 },
      );
    }
  }

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;

    if (invoiceId) {
      await db
        .update(invoices)
        .set({
          paymentStatus: 'paid',
          paidAt: new Date(),
          paymentMethod: 'stripe',
          stripeCheckoutSessionId: session.id,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));

      console.log(`[stripe-webhook] Invoice ${invoiceId} marked as paid`);
    }
  }

  return NextResponse.json({ received: true });
}
