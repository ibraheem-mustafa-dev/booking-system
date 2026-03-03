# PRD: Stripe Invoice Payments

**Status:** Approved — build it

## Goal
Let clients pay invoices online via a Stripe-hosted payment link. When paid, the invoice status updates automatically via webhook.

## User Stories
- As a **client**, I receive an invoice with a "Pay Now" button that takes me to Stripe Checkout
- As a **host**, I see invoice status update to "paid" automatically when the client pays
- As a **host**, I can manually mark invoices as paid from the dashboard (already partially exists)

## Implementation Plan

### 1. Stripe dependencies
Already in `.env.production` / `.env`: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`. Read from `C:\Users\Bean\.openclaw\workspace\.env.stripe` for key values.
Install if not already present: `npm install stripe`

### 2. Stripe client singleton
Create `src/lib/stripe.ts`:
```ts
import Stripe from 'stripe';
let _stripe: Stripe | null = null;
export function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' });
  return _stripe;
}
```

### 3. Schema additions to invoices table
Check `src/lib/db/schema.ts` invoices table. Add if missing:
- `stripePaymentIntentId: text('stripe_payment_intent_id')`
- `stripeCheckoutSessionId: text('stripe_checkout_session_id')`
- `paidAt: timestamp('paid_at', { withTimezone: true })`
Run `npx drizzle-kit generate` after schema changes.

### 4. Create Checkout Session API route
`src/app/api/invoices/[id]/checkout/route.ts` — POST endpoint
- Verifies invoice exists and belongs to org (via Supabase auth on the request, OR use a token from the invoice)
- Creates a Stripe Checkout Session (mode: 'payment', line_items from invoice amount + description)
- Stores stripeCheckoutSessionId on invoice
- Returns `{ url: session.url }` for redirect
- success_url: `${APP_URL}/invoice/[id]/paid`
- cancel_url: `${APP_URL}/invoice/[id]`

### 5. Stripe webhook handler
`src/app/api/webhooks/stripe/route.ts` — POST
- Verifies Stripe signature using `STRIPE_WEBHOOK_SECRET`
- Handles `checkout.session.completed`:
  - Finds invoice by stripeCheckoutSessionId
  - Updates status to 'paid', sets paidAt = now()
- Returns 200 immediately (no long processing in webhook)

Add `STRIPE_WEBHOOK_SECRET` to `.env.example`

### 6. Invoice tRPC mutation: createCheckoutSession
In `src/server/routers/invoices.ts`, add:
```ts
createCheckoutSession: orgProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    // verify invoice belongs to org
    // call /api/invoices/[id]/checkout internally OR inline the Stripe logic
    // return { url: checkoutUrl }
  })
```

### 7. Invoice detail page — Pay Now button
In `src/app/(dashboard)/dashboard/invoices/[id]/page.tsx`:
- Add "Pay Now" button for unpaid invoices
- On click: calls tRPC createCheckoutSession, redirects to Stripe URL
- Show paid badge + paidAt date when status = 'paid'

### 8. Public invoice payment page (for clients without login)
`src/app/invoice/[id]/page.tsx` — public page
- Shows invoice summary (amount, description, due date)
- "Pay Now" button using a payment token (add `paymentToken` to invoices schema — unique UUID)
- No auth required — token is the key
- Also used as the success/cancel redirect target

### 9. Middleware exclusion
Add `/api/webhooks/stripe` to the middleware matcher exclusion list (Stripe can't send cookies).

### Env vars needed
- `STRIPE_SECRET_KEY` — already in .env.stripe
- `STRIPE_PUBLISHABLE_KEY` — already in .env.stripe
- `STRIPE_WEBHOOK_SECRET` — get from Stripe dashboard webhook config
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — for client-side use

### TypeScript + Build
Run `npx tsc --noEmit` and `npm run build` before committing. Commit in logical groups.
