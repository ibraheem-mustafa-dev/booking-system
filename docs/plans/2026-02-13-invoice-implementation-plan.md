# Invoice System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Branded PDF invoice generation with auto-creation for paid bookings, dashboard management, and public download endpoint.

**Architecture:** `@react-pdf/renderer` generates PDFs on-the-fly from DB data. tRPC router for authenticated dashboard operations. Public REST endpoint with `downloadToken` for email links and WP plugin. Auto-creation triggered by `bookingType.requiresPayment`.

**Tech Stack:** @react-pdf/renderer, Drizzle ORM, tRPC v11, React Email + Resend, shadcn/ui, Next.js App Router

**Design doc:** `docs/plans/2026-02-13-invoice-system-design.md`

---

## Task 1: Install dependency and update schema

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `package.json`

**Step 1: Install @react-pdf/renderer**

```bash
npm install @react-pdf/renderer
```

**Step 2: Add columns to invoices table**

In `src/lib/db/schema.ts`, add to the `invoices` table definition, after the `notes` column:

```typescript
dueDate: date('due_date').notNull(),
downloadToken: varchar('download_token', { length: 64 }),
```

Add a unique index for `downloadToken` in the table's index array:

```typescript
uniqueIndex('invoices_download_token_idx').on(table.downloadToken),
```

**Step 3: Add companyRegistrationNumber to branding type**

In the `organisations` table, update the `branding` JSONB `$type<>` to add:

```typescript
companyRegistrationNumber?: string;
```

No default change needed — it's optional.

**Step 4: Generate and push migration**

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

> User must run these since they connect to the DB.

**Step 5: Commit**

```bash
git add src/lib/db/schema.ts package.json package-lock.json
git commit -m "feat: add dueDate, downloadToken to invoices schema; add companyRegistrationNumber to branding"
```

---

## Task 2: Invoice number generation (TDD)

**Files:**
- Create: `src/lib/invoice/number.ts`
- Create: `src/lib/invoice/number.test.ts`

**Step 1: Write the failing test**

Create `src/lib/invoice/number.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseInvoiceNumber, formatInvoiceNumber } from './number';

describe('parseInvoiceNumber', () => {
  it('extracts the numeric part from INV-0001', () => {
    expect(parseInvoiceNumber('INV-0001')).toBe(1);
  });

  it('extracts the numeric part from INV-0042', () => {
    expect(parseInvoiceNumber('INV-0042')).toBe(42);
  });

  it('returns 0 for null input', () => {
    expect(parseInvoiceNumber(null)).toBe(0);
  });
});

describe('formatInvoiceNumber', () => {
  it('formats 1 as INV-0001', () => {
    expect(formatInvoiceNumber(1)).toBe('INV-0001');
  });

  it('formats 42 as INV-0042', () => {
    expect(formatInvoiceNumber(42)).toBe('INV-0042');
  });

  it('formats 9999 as INV-9999', () => {
    expect(formatInvoiceNumber(9999)).toBe('INV-9999');
  });

  it('formats 10000 as INV-10000 (no truncation)', () => {
    expect(formatInvoiceNumber(10000)).toBe('INV-10000');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/invoice/number.test.ts
```

Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `src/lib/invoice/number.ts`:

```typescript
/**
 * Parse the numeric suffix from an invoice number string.
 * Returns 0 if the input is null or unparseable.
 */
export function parseInvoiceNumber(invoiceNumber: string | null): number {
  if (!invoiceNumber) return 0;
  const match = invoiceNumber.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Format a sequential number as an invoice number string.
 * Pads to 4 digits minimum: 1 -> "INV-0001", 10000 -> "INV-10000".
 */
export function formatInvoiceNumber(seq: number): string {
  return `INV-${String(seq).padStart(4, '0')}`;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/invoice/number.test.ts
```

Expected: all 7 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/invoice/number.ts src/lib/invoice/number.test.ts
git commit -m "feat: add invoice number parsing and formatting with tests"
```

---

## Task 3: Fix email attachment interface for binary content

**Files:**
- Modify: `src/lib/email/resend.ts`

**Step 1: Update the attachment type**

In `src/lib/email/resend.ts`, change the `attachments` type in `SendEmailOptions`:

```typescript
// Before:
attachments?: {
  filename: string;
  content: string;
}[];

// After:
attachments?: {
  filename: string;
  content: string | Buffer;
}[];
```

**Step 2: Update the mapping to handle Buffer**

In the `sendEmail` function, change the attachments mapping:

```typescript
// Before:
attachments: attachments?.map((attachment) => ({
  filename: attachment.filename,
  content: Buffer.from(attachment.content),
})),

// After:
attachments: attachments?.map((attachment) => ({
  filename: attachment.filename,
  content: typeof attachment.content === 'string'
    ? Buffer.from(attachment.content)
    : attachment.content,
})),
```

**Step 3: Commit**

```bash
git add src/lib/email/resend.ts
git commit -m "fix: support Buffer attachments in sendEmail for binary PDFs"
```

---

## Task 4: PDF template component

**Files:**
- Create: `src/lib/invoice/template.tsx`

**Step 1: Create the PDF template**

Create `src/lib/invoice/template.tsx`. This is a `@react-pdf/renderer` component — A4 portrait with branded header, from/to addresses, line items table, totals, and footer.

The component receives typed props:

```typescript
export interface InvoicePdfProps {
  invoiceNumber: string;
  invoiceDate: string;       // DD/MM/YYYY
  dueDate: string;           // DD/MM/YYYY
  supplyDate?: string;       // DD/MM/YYYY (booking date, if linked)

  // Seller (org)
  orgName: string;
  companyName?: string;
  companyAddress?: string;
  vatNumber?: string;
  companyRegistrationNumber?: string;
  contactEmail: string;
  logoUrl?: string;
  primaryColour: string;
  accentColour: string;

  // Buyer (client)
  clientName: string;
  clientEmail: string;

  // Line items
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];

  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
  paymentStatus: string;

  // Footer
  notes?: string;
  terms?: string;
  bookingReference?: string; // e.g. "15 Mar 2026, 10:00-11:00 — Discovery Call"
}
```

Full implementation: `Document` > `Page` (A4) > sections for header, addresses, line items table, totals, footer. Uses `StyleSheet.create()` for styles. Colours from props. Dates formatted DD/MM/YYYY. Currency symbol derived from `currency` prop (GBP -> "£"). Payment status badge rendered as coloured `View` + `Text`.

**Key styling rules:**
- Header bar: `backgroundColor: primaryColour`, white text
- Total row: `backgroundColor: accentColour`
- Body: `color: '#1a1a1a'`, `fontFamily: 'Helvetica'`
- Page padding: 40pt all sides

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/lib/invoice/template.tsx
git commit -m "feat: add @react-pdf/renderer invoice PDF template with HMRC-compliant layout"
```

---

## Task 5: PDF generation helper

**Files:**
- Create: `src/lib/invoice/generate.ts`

**Step 1: Create the generation helper**

Create `src/lib/invoice/generate.ts`:

```typescript
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { InvoiceTemplate } from './template';
import type { InvoicePdfProps } from './template';

/**
 * Generate an invoice PDF as a Buffer.
 * Used for email attachments and API responses.
 */
export async function generateInvoicePdf(
  props: InvoicePdfProps,
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    createElement(InvoiceTemplate, props),
  );
  return Buffer.from(buffer);
}
```

> Note: `renderToBuffer` returns `NodeJS.ReadableStream` in some versions — need to verify. If it returns a `Uint8Array`, `Buffer.from()` handles it. If it returns a stream, we collect chunks. The Context7 docs show it returns a Promise<Buffer>-like value.

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/invoice/generate.ts
git commit -m "feat: add invoice PDF buffer generation helper"
```

---

## Task 6: Invoice email template

**Files:**
- Create: `src/lib/email/templates/invoice-email.tsx`

**Step 1: Create the email template**

Create `src/lib/email/templates/invoice-email.tsx` using existing `EmailLayout` wrapper. Same pattern as `confirmation.tsx`.

Props:

```typescript
export interface InvoiceEmailProps {
  clientName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalFormatted: string;     // e.g. "£60.00"
  paymentStatus: string;
  downloadUrl: string;         // public PDF download link with token
  bookingTypeName?: string;
  bookingDateFormatted?: string;
  terms?: string;              // payment instructions / BACS details
  contactEmail: string;        // org owner email for queries
  orgName: string;
  orgLogoUrl?: string;
  primaryColour: string;
}
```

Body structure:
1. "Hi {clientName}," greeting
2. "Here is your invoice for {bookingTypeName}." (if linked to booking)
3. Summary box with: Invoice #, Date, Due Date, Total, Status badge
4. "Download Invoice" button (CTA, styled with primaryColour)
5. Payment instructions from `terms` (if present)
6. "Questions? Contact {contactEmail}"
7. Standard footer via EmailLayout

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/email/templates/invoice-email.tsx
git commit -m "feat: add invoice email template with branded layout and PDF download link"
```

---

## Task 7: tRPC invoices router (core CRUD)

**Files:**
- Create: `src/server/routers/invoices.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the invoices router**

Create `src/server/routers/invoices.ts` with these procedures:

- **`list`** — `orgProcedure` query. Accepts optional `page` and `limit` (default 20). Returns invoices where `orgId = ctx.orgId`, ordered by `createdAt DESC`. Includes pagination metadata.

- **`getById`** — `orgProcedure` query. Accepts `id: string`. Joins with `bookings` and `bookingTypes` to include booking reference. Validates org ownership.

- **`create`** — `orgProcedure` mutation. Accepts: `bookingId?`, `clientName`, `clientEmail`, `lineItems[]`, `vatRate?`, `notes?`, `dueDate?`. Generates next invoice number (transactional MAX query), generates `downloadToken` via `randomBytes(32).toString('hex')`, inserts row. If `bookingId` provided, validates booking belongs to the org.

- **`update`** — `orgProcedure` mutation. Accepts `id`, plus editable fields. Only allows update when `paymentStatus === 'pending'`. Throws FORBIDDEN if invoice is paid/refunded.

- **`markPaid`** — `orgProcedure` mutation. Accepts `id`, optional `paymentMethod`. Sets `paymentStatus: 'paid'`, `paidAt: new Date()`.

- **`markRefunded`** — `orgProcedure` mutation. Accepts `id`. Sets `paymentStatus: 'refunded'`.

Zod validation schemas for all inputs. Empty string to null for optional text fields (`|| null` not `?? null`).

**Step 2: Register in app router**

In `src/server/routers/_app.ts`, add:

```typescript
import { invoicesRouter } from './invoices';

export const appRouter = router({
  bookingTypes: bookingTypesRouter,
  availability: availabilityRouter,
  calendar: calendarRouter,
  invoices: invoicesRouter,
});
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/invoices.ts src/server/routers/_app.ts
git commit -m "feat: add invoices tRPC router with list, create, update, markPaid, markRefunded"
```

---

## Task 8: tRPC PDF download and resend email procedures

**Files:**
- Modify: `src/server/routers/invoices.ts`

**Step 1: Add downloadPdf procedure**

Add to invoices router:

- **`downloadPdf`** — `orgProcedure` query. Accepts `id`. Loads invoice + org branding + org owner email. Builds `InvoicePdfProps` from DB data. Calls `generateInvoicePdf()`. Returns `{ base64: buffer.toString('base64'), filename: 'INV-0001.pdf' }`.

**Step 2: Add resendEmail procedure**

Add to invoices router:

- **`resendEmail`** — `orgProcedure` mutation. Accepts `id`. Loads invoice + org + owner. Generates PDF buffer. Sends email with PDF attachment using `sendEmail()`. Returns `{ sent: true }` or throws on failure.

Builds the email using `createElement(InvoiceEmail, props)` and attaches the PDF buffer.

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/server/routers/invoices.ts
git commit -m "feat: add downloadPdf and resendEmail procedures to invoices router"
```

---

## Task 9: Public REST endpoint for PDF download

**Files:**
- Create: `src/app/api/v1/invoices/[id]/pdf/route.ts`

**Step 1: Create the route**

Create `src/app/api/v1/invoices/[id]/pdf/route.ts`:

- `OPTIONS` handler returning CORS headers
- `GET` handler:
  1. Extract `id` from params, `token` from query string
  2. Validate `token` is present (400 if missing)
  3. Query `invoices` where `id = id AND downloadToken = token`, join with `organisations` and `users` (for org owner email)
  4. Return 404 if not found
  5. Build `InvoicePdfProps` from DB data
  6. Call `generateInvoicePdf(props)`
  7. Return `new NextResponse(buffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="INV-0001.pdf"' } })`

Same CORS pattern as other `/api/v1/` routes.

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/v1/invoices/[id]/pdf/route.ts
git commit -m "feat: add public invoice PDF download endpoint with token auth"
```

---

## Task 10: Auto-create invoices for paid bookings

**Files:**
- Modify: `src/app/api/v1/book/[orgSlug]/[typeSlug]/create/route.ts`

**Step 1: Add invoice auto-creation**

After the booking insert (line ~164 in current file), before the `sendBookingEmails` call, add:

```typescript
// Auto-create invoice for paid booking types
if (type.requiresPayment && type.priceAmount) {
  try {
    const priceNum = parseFloat(type.priceAmount);
    // ... generate next invoice number, insert invoice row
    // ... fire-and-forget invoice email
  } catch (err) {
    console.error('[booking] Invoice auto-creation failed:', err);
    // Don't fail the booking — invoice creation is best-effort
  }
}
```

The logic:
1. Query max invoice number for the org
2. Format next number
3. Calculate VAT (default 0 unless org has VAT rate configured)
4. Insert invoice with `downloadToken`, `dueDate: today`, single line item from booking type
5. Send invoice email async (fire-and-forget)

Need to also `select` the full `type` row (currently only selects all columns — verify `priceAmount` and `requiresPayment` are in the result).

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/v1/book/[orgSlug]/[typeSlug]/create/route.ts
git commit -m "feat: auto-create invoices for paid booking types on booking creation"
```

---

## Task 11: Dashboard sidebar update

**Files:**
- Modify: `src/app/(dashboard)/sidebar.tsx`

**Step 1: Add Invoices nav item**

Import `Receipt` from `lucide-react`. Add to `navItems` array between Bookings and Booking Types:

```typescript
{ href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/sidebar.tsx
git commit -m "feat: add Invoices nav item to dashboard sidebar"
```

---

## Task 12: Invoice list page

**Files:**
- Create: `src/app/(dashboard)/dashboard/invoices/page.tsx`

**Step 1: Create the list page**

`'use client'` component. Uses `trpc.invoices.list.useQuery()`.

Components used (existing shadcn/ui): Table, Badge, Button, DropdownMenu, Skeleton, SidebarTrigger, Separator.

Table columns: Invoice #, Client (name + email), Amount (formatted with currency), Status (badge), Date (DD/MM/YYYY), Actions (dropdown).

Status badge variants:
- `pending` — amber/warning
- `paid` — green/success
- `refunded` — grey/secondary
- `cancelled` — red/destructive

Actions dropdown per row:
- View (navigates to detail page)
- Download PDF (calls `trpc.invoices.downloadPdf`, decodes base64, triggers browser download)
- Resend Email (calls `trpc.invoices.resendEmail`, shows toast)
- Mark Paid (calls `trpc.invoices.markPaid`, shows toast)
- Mark Refunded (calls `trpc.invoices.markRefunded`, shows toast)

"Create Invoice" button top-right links to `/dashboard/invoices/new`.

Empty state when no invoices exist.

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/invoices/page.tsx
git commit -m "feat: add invoice list page with table, status badges, and actions"
```

---

## Task 13: Invoice detail page

**Files:**
- Create: `src/app/(dashboard)/dashboard/invoices/[id]/page.tsx`

**Step 1: Create the detail page**

`'use client'` component. Uses `trpc.invoices.getById.useQuery()`.

Renders an HTML version of the invoice layout (matches the PDF structure visually but uses regular HTML/Tailwind, not @react-pdf/renderer).

Action buttons: Download PDF, Resend Email, Mark Paid / Mark Refunded (conditional on status), Edit (only when pending, links to edit page).

If invoice has an associated booking, show a link to the booking detail (or just the booking reference text for now since booking detail page may not exist yet).

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/invoices/[id]/page.tsx
git commit -m "feat: add invoice detail page with HTML preview and action buttons"
```

---

## Task 14: Invoice create and edit pages

**Files:**
- Create: `src/app/(dashboard)/dashboard/invoices/new/page.tsx`
- Create: `src/app/(dashboard)/dashboard/invoices/[id]/edit/page.tsx`

**Step 1: Create the create page**

`'use client'` component. Form with:
- Client name (text input, required)
- Client email (email input, required)
- Line items (dynamic list: description, quantity, unit price — with add/remove buttons)
- VAT rate (number input, default 0)
- Notes (textarea, optional)
- Due date (date input, defaults to today)
- Invoice number displayed as read-only text (generated on submit)

If `bookingId` query param exists, calls `trpc.bookingTypes.getById` to pre-fill:
- Client name/email from the booking
- Line item: booking type name, qty 1, price from bookingType.priceAmount

Two submit buttons:
- "Save Draft" — creates invoice, navigates to detail page
- "Save & Send" — creates invoice, sends email, navigates to detail page with success toast

Uses existing shadcn/ui: Input, Label, Button, Textarea, Card.

**Step 2: Create the edit page**

Similar form but loads existing invoice via `trpc.invoices.getById`. Pre-fills all fields. Only accessible when `paymentStatus === 'pending'` — redirects to detail page with toast if not.

Calls `trpc.invoices.update` on submit.

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/(dashboard)/dashboard/invoices/new/page.tsx src/app/(dashboard)/dashboard/invoices/[id]/edit/page.tsx
git commit -m "feat: add invoice create and edit pages with dynamic line items"
```

---

## Task 15: Verify everything works

**Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all existing tests pass + new invoice number tests pass.

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Run linter**

```bash
npm run lint
```

Expected: no errors (warnings acceptable).

**Step 4: Test dev server**

```bash
npm run dev
```

Navigate to `http://localhost:3000/dashboard/invoices` — verify the page loads with empty state.

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address lint/type errors from invoice system implementation"
```

---

## Summary

| Task | Description | Files |
|---|---|---|
| 1 | Install dep + schema changes | schema.ts, package.json |
| 2 | Invoice number generation (TDD) | number.ts, number.test.ts |
| 3 | Email attachment fix | resend.ts |
| 4 | PDF template | template.tsx |
| 5 | PDF generation helper | generate.ts |
| 6 | Invoice email template | invoice-email.tsx |
| 7 | tRPC router (CRUD) | invoices.ts, _app.ts |
| 8 | tRPC PDF download + resend | invoices.ts |
| 9 | Public REST endpoint | route.ts |
| 10 | Auto-create in booking flow | create/route.ts |
| 11 | Sidebar update | sidebar.tsx |
| 12 | Invoice list page | invoices/page.tsx |
| 13 | Invoice detail page | invoices/[id]/page.tsx |
| 14 | Create + edit pages | new/page.tsx, [id]/edit/page.tsx |
| 15 | Verify everything | tests, types, lint, dev server |

Total: 15 tasks, ~11 new files, ~5 modified files, estimated 10-15 commits.

## Watch Out For

- **Empty string to null:** use `|| null` not `?? null` for optional fields mapping to non-text DB columns
- **Zod v4 `z.record()`:** needs 2 args — `z.record(z.string(), z.union([...]))`
- **`.env.local` cannot be edited by Claude** — ask user to add any new env vars manually
- **date-fns-tz v3:** uses `toZonedTime()` not `utcToZonedTime()`
- **`@react-pdf/renderer` on Windows:** may need specific Node.js canvas dependencies — test early
- **Decimal columns from Drizzle:** `priceAmount`, `subtotal`, `total` come back as strings, not numbers — parse with `parseFloat()` before formatting
