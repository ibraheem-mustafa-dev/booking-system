# Invoice System Design — Step 12

Date: 13 February 2026

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Trigger | Auto-create for paid booking types (`requiresPayment: true`) + manual creation for any booking | Uses existing flag, covers 90% of cases |
| PDF library | `@react-pdf/renderer` | No headless browser (saves RAM on 8GB VPS), ~100ms generation, React component model |
| Storage | Generate on-the-fly from DB data | No stale PDF problem, no storage costs |
| Invoice number | `INV-0001` sequential per org | Standard UK format, simple |
| Due date | Defaults to creation date (most bookings are pay-on-book) | Overridable for corporate invoicing |
| Client address | Omitted for MVP | Only required for full VAT B2B invoices; adding it means changing the public booking form — scope creep |
| Public access | Token-authenticated REST endpoint | Email links + future WP plugin customer portal |

## Schema Changes

Add to `invoices` table:

```
dueDate: date('due_date').notNull()
downloadToken: varchar('download_token', { length: 64 })
```

Add to `organisations.branding` JSONB type:

```
companyRegistrationNumber?: string
```

No new tables. No new enums.

## PDF Template

File: `src/lib/invoice/template.tsx`

A4 portrait, `@react-pdf/renderer` components (`Document`, `Page`, `View`, `Text`, `Image`, `StyleSheet`).

### Layout

```
+--------------------------------------+
| [Logo]               INVOICE         |
| Org Name             INV-0001        |
|                      Date: 13/02/2026|
|                      Due:  13/02/2026|
|                      Supply: 15/03/26|
+--------------------------------------+
| FROM                   TO            |
| Company Name           Client Name   |
| Company Address        Client Email  |
| VAT: GB123456789                     |
| Co. Reg: 12345678                    |
| Contact: owner@email.com             |
+--------------------------------------+
| Description      Qty   Price   Total |
| ------------------------------------ |
| 60min Consult     1   £50.00  £50.00 |
|                                      |
|              Subtotal:       £50.00  |
|              VAT (20%):      £10.00  |
|              TOTAL:          £60.00  |
|                         [PAID badge] |
+--------------------------------------+
| Booking: 15 Mar 2026, 10:00-11:00   |
| Payment terms / BACS details         |
| from org's "terms" field             |
+--------------------------------------+
```

### HMRC Compliance

Includes all fields required by HMRC for UK invoices:
- Unique invoice number
- Invoice date and supply date (booking date)
- Seller: company name, address, VAT number, company registration number, contact email
- Buyer: client name, client email
- Line items: description, quantity, unit price, line total
- Subtotal, VAT rate, VAT amount, total including VAT
- Payment status

Source: [Eurofiscalis UK Invoicing Guide](https://www.eurofiscalis.com/en/invoicing-in-great-britain/)

### Styling

- Header bar: org `primaryColour`
- Total row background: org `accentColour`
- Body text: `#1a1a1a`
- Font: Helvetica (built-in, no custom font loading)
- Dates formatted DD/MM/YYYY (UK convention)

## API Endpoints

### tRPC Router (`invoices`)

All procedures are `orgProcedure` (requires auth + org membership).

| Procedure | Type | Description |
|---|---|---|
| `invoices.list` | query | Paginated list, org-scoped |
| `invoices.getById` | query | Single invoice with org + booking details |
| `invoices.create` | mutation | Create from booking or standalone |
| `invoices.update` | mutation | Edit line items, notes, client details (pending status only) |
| `invoices.markPaid` | mutation | Set `paymentStatus: 'paid'`, `paidAt: now()` |
| `invoices.markRefunded` | mutation | Set `paymentStatus: 'refunded'` |
| `invoices.downloadPdf` | query | Generate PDF via `renderToBuffer()`, return base64 |
| `invoices.resendEmail` | mutation | Re-generate PDF, re-send invoice email to client |

### REST Endpoint (Public)

`GET /api/v1/invoices/[id]/pdf?token={downloadToken}`

- Validates `downloadToken` against DB
- Generates PDF via `renderToBuffer()`
- Returns `Content-Type: application/pdf` with `Content-Disposition: attachment`
- CORS headers for WP plugin cross-origin access

## Auto-Creation Flow

In the booking create endpoint (`/api/v1/book/.../create`), after inserting the booking:

1. Check `bookingType.requiresPayment === true`
2. If true, start a transaction:
   a. Query `SELECT MAX(invoice_number) FROM invoices WHERE org_id = ?`
   b. Parse numeric part, increment: `INV-0001` -> `INV-0002`
   c. Insert invoice row with: line item from booking type, price, `paymentStatus: 'pending'`, `dueDate: today`, generated `downloadToken`
3. Send invoice email (fire-and-forget, same pattern as booking emails)

## Email

### Template

File: `src/lib/email/templates/invoice-email.tsx`

Uses existing `EmailLayout` wrapper (org logo, primary colour, footer).

- Subject: `Invoice {invoiceNumber} from {orgName}`
- Body: greeting, invoice summary box (number, date, due date, amount, status), "Download Invoice" button, payment instructions from org `terms`, org contact email
- PDF attached via `renderToBuffer()` + Resend `attachments` array

### Attachment Fix

Update `SendEmailOptions.attachments` in `src/lib/email/resend.ts` to accept `content: string | Buffer`. Skip `Buffer.from()` when content is already a Buffer.

### Trigger Points

| Trigger | When |
|---|---|
| Auto-create | Immediately after invoice auto-creation in booking flow |
| Manual send | `invoices.resendEmail` tRPC mutation from dashboard |
| Save & Send | Create invoice page "Save & Send" button |

## Dashboard UI

### Sidebar

Add "Invoices" nav item between "Bookings" and "Booking Types" (lucide `Receipt` icon).

### Invoice List (`/dashboard/invoices`)

- Table: Invoice #, Client, Amount, Status (badge), Date, Actions
- Status badges: pending (amber), paid (green), refunded (grey), cancelled (red)
- Row actions dropdown: View, Download PDF, Resend Email, Mark Paid, Mark Refunded
- "Create Invoice" button top-right
- Skeleton loading, empty state

### Invoice Detail (`/dashboard/invoices/[id]`)

- HTML preview matching PDF layout
- Action buttons: Download PDF, Resend Email, Mark Paid / Mark Refunded
- Edit button (pending status only)
- Link to associated booking

### Create/Edit (`/dashboard/invoices/new?bookingId=...`)

- Pre-fills from booking if `bookingId` param present
- Fields: client name, client email, line items (add/remove rows), VAT rate, notes, due date
- Invoice number shown read-only (auto-generated)
- "Save & Send" and "Save Draft" buttons

## Competitor Failures Addressed

Research from Acuity Scheduling forum, Reddit r/smallbusiness, and general booking software reviews:

| Competitor Problem | Our Solution |
|---|---|
| Acuity: "Everything is bad in your template" — no customisation | Org branding (logo, colours, company details) |
| Acuity: no business name/address on invoices | Full company info from org branding |
| Acuity: "use QuickBooks instead" — offloads to external app | Native invoicing, no third-party required |
| Acuity: auto-receipts fail silently | Resend with error logging + manual resend from dashboard |
| Calendly: no invoicing at all | Built-in from Step 12 |
| Cal.com: no invoicing, Stripe receipts only | Full branded invoices with PDF |
| General: can't re-send failed receipts | `invoices.resendEmail` tRPC mutation |
| General: can't edit invoices after creation | `invoices.update` (while pending) |

## Dependencies

- `@react-pdf/renderer` — PDF generation (new dependency)
- Existing: Resend, React Email, Drizzle, tRPC, shadcn/ui, lucide-react

## Files to Create

```
src/lib/invoice/template.tsx          # @react-pdf/renderer PDF template
src/lib/invoice/generate.ts           # renderToBuffer/renderToStream helpers
src/lib/invoice/number.ts             # Invoice number generation (transactional)
src/lib/email/templates/invoice-email.tsx  # Invoice email template
src/server/routers/invoices.ts        # tRPC router
src/app/api/v1/invoices/[id]/pdf/route.ts  # Public PDF download endpoint
src/app/(dashboard)/dashboard/invoices/page.tsx           # List page
src/app/(dashboard)/dashboard/invoices/[id]/page.tsx      # Detail page
src/app/(dashboard)/dashboard/invoices/new/page.tsx       # Create page
src/app/(dashboard)/dashboard/invoices/[id]/edit/page.tsx # Edit page
```

## Files to Modify

```
src/lib/db/schema.ts                  # Add dueDate, downloadToken to invoices; companyRegistrationNumber to branding type
src/lib/email/resend.ts               # Attachment interface: accept Buffer | string
src/lib/email/send-booking-emails.ts  # Add invoice auto-creation after paid bookings
src/server/routers/_app.ts            # Register invoices router
src/app/(dashboard)/sidebar.tsx       # Add Invoices nav item
```
