import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Lazy-initialised Stripe client.
 * Returns null if STRIPE_SECRET_KEY is not set (e.g. during build or dev without Stripe).
 */
export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
    });
  }
  return _stripe;
}
