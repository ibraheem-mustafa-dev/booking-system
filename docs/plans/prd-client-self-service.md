# PRD: Client Self-Service (Reschedule + Cancel)

**Status:** Approved — build it

## Goal
Clients can reschedule or cancel their own bookings via token-based links in their confirmation and reminder emails. No login required — the token IS the auth.

## User Stories
- As a **client**, I click "Reschedule" in my confirmation email and land on a page to pick a new time
- As a **client**, I click "Cancel" in my confirmation email and confirm the cancellation
- As a **host**, cancelled bookings update status automatically; I receive a notification email
- As a **host**, rescheduled bookings update with the new time; I receive a notification email

## Implementation Plan

### 1. Token validation helper
Create `src/lib/booking-tokens.ts`:
```ts
export async function getBookingByRescheduleToken(token: string)
export async function getBookingByCancellationToken(token: string)
```
Simple DB lookups — tokens already exist on bookings table.

### 2. Cancel flow
**API route:** `src/app/api/v1/booking/cancel/route.ts` — POST `{ token }`
- Finds booking by cancellationToken
- Verifies booking is not already cancelled / in the past
- Updates status to 'cancelled', sets cancelledAt = now()
- Sends cancellation notification email to host (new template: `src/lib/email/templates/cancellation-notification.tsx`)
- Cancels any pending BullMQ reminder jobs (removeEmailJob for each bookingReminder row)
- Returns `{ success: true }`

**Cancel page:** `src/app/book/[orgSlug]/[typeSlug]/cancel/page.tsx`
- Reads `?token=...` from URL
- Shows booking summary + "Confirm Cancellation" button
- On confirm: calls cancel API, shows success message

### 3. Reschedule flow
**Availability API already exists** at `/api/v1/book/[orgSlug]/[typeSlug]/availability`

**Reschedule page:** `src/app/book/[orgSlug]/[typeSlug]/reschedule/page.tsx`
- Reads `?token=...` from URL
- Shows existing booking details at top
- Below: same date/time picker as booking page (reuse the existing booking form components)
- On submit: calls reschedule API

**Reschedule API:** `src/app/api/v1/booking/reschedule/route.ts` — POST `{ token, startAt, endAt }`
- Finds booking by rescheduleToken
- Verifies new time is available (check against existing bookings)
- Updates startAt, endAt on the booking
- Regenerates BullMQ reminder jobs (cancel old, schedule new)
- Sends updated confirmation email to client
- Sends reschedule notification to host
- Returns `{ success: true, booking }`

### 4. Email templates
Add `src/lib/email/templates/cancellation-notification.tsx` — tells host a client cancelled
Add `src/lib/email/templates/reschedule-notification.tsx` — tells host a client rescheduled (with old + new time)

### 5. Update confirmation email URLs
The confirmation template already has `rescheduleUrl` and `cancelUrl` props with placeholder values. These are now real:
- rescheduleUrl: `${APP_URL}/book/${orgSlug}/${typeSlug}/reschedule?token=${rescheduleToken}`
- cancelUrl: `${APP_URL}/book/${orgSlug}/${typeSlug}/cancel?token=${cancellationToken}`

The sendBookingEmails() function already passes these — they'll now point to real pages.

### 6. Guard rails
- Cannot reschedule/cancel a booking that already happened (startAt in the past)
- Cannot reschedule/cancel a booking that's already cancelled
- Show appropriate error messages on the pages
- Each token is single-use for cancel (once cancelled, token no longer valid)
- Reschedule tokens remain valid for multiple uses (allow multiple reschedules)

### TypeScript + Build
Run `npx tsc --noEmit` and `npm run build`. Commit in logical groups.
