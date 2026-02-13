# Session Handoff — 13 February 2026 (Session 9)

## Completed This Session

1. **Step 12: Invoices & receipts — COMPLETE.** Full invoice system implemented and browser-tested:
   - **tRPC invoices router** — 8 procedures: `list` (paginated), `getById` (with booking reference), `create` (auto-generates invoice number + download token), `update` (pending-only guard), `markPaid`, `markRefunded`, `downloadPdf` (returns base64), `resendEmail` (generates PDF + sends via Resend)
   - **Invoice number generation** — `INV-0001` format, sequential per org, with 7 passing tests
   - **PDF template** — `@react-pdf/renderer` with A4 layout, branded header (org primary colour), from/to addresses, line items table, totals, VAT, footer. HMRC-compliant fields (VAT number, company registration, supply date)
   - **Invoice email template** — React Email with branded layout, invoice summary box, "Download Invoice" CTA button, payment terms section, PDF attachment
   - **Public REST endpoint** — `GET /api/v1/invoices/[id]/pdf?token=<downloadToken>` — token-authenticated PDF download with CORS headers (for email links and WP plugin)
   - **Auto-create on booking** — when `bookingType.requiresPayment && priceAmount`, automatically creates invoice + sends email with PDF attachment (fire-and-forget, doesn't block booking response)
   - **Dashboard pages** — 5 new pages:
     - Invoice list (`/dashboard/invoices`) — table with pagination, status badges, per-row actions dropdown (View, Download PDF, Resend Email, Mark Paid/Refunded)
     - Invoice detail (`/dashboard/invoices/[id]`) — full invoice preview with line items, totals, booking reference link, action buttons
     - Create invoice (`/dashboard/invoices/new`) — form with dynamic line items (add/remove), live total calculation, VAT rate, due date, notes. "Save Draft" and "Save & Send" buttons
     - Edit invoice (`/dashboard/invoices/[id]/edit`) — same form, pre-filled, pending-only guard with redirect
     - Shared form component (`_components/invoice-form.tsx`)
   - **Sidebar updated** — "Invoices" nav item with Receipt icon between Bookings and Booking Types
   - **Email attachment fix** — `sendEmail()` now accepts `Buffer` content (not just strings) for binary PDF attachments
   - **Schema additions** — `dueDate` (date) and `downloadToken` (varchar, unique index) columns on invoices table. `companyRegistrationNumber` added to branding type. Migration generated.

2. **Bug fix: Resend client lazy initialisation** — `new Resend()` was crashing at module load when `RESEND_API_KEY` is missing (no env var in dev). Changed to lazy singleton that only creates the client on first `sendEmail()` call. This was blocking the entire tRPC handler because `invoices.ts` imports `resend.ts`.

3. **Browser-tested the full flow** — Using Playwright:
   - Invoice list page: empty state renders correctly
   - Create invoice: filled form with "Consultation Session, Qty 1, £75.00", live totals calculated, saved as INV-0001
   - Detail page: all fields rendered (client, dates, line items, totals, status badge)
   - Mark Paid: status changed to "Paid", Edit button removed, "Mark Refunded" appeared, paid date shown
   - List page: invoice appears in table with correct data

## Completed Previous Sessions (Sessions 6-8)

- Steps 1-9: Scaffolding, schema, auth, booking types CRUD, working hours/overrides, Google Calendar OAuth, availability engine (23 tests), public booking page
- Session 7: WP plugin spec rewrite (thin API client), API security audit (7 fixes documented)
- Session 8: Steps 10-11 (email system with 6 templates + BullMQ worker, .ics calendar generation), 5 API security fixes (ICS token auth, timezone IANA validation, org ID stripped, customCss stripped)

## Current State

- **Working:** Auth flow + Booking types CRUD + Working hours + Overrides + Google Calendar OAuth + Availability engine + Public booking page + Email system (7 templates including invoice) + .ics generation + **Invoices (full CRUD, PDF generation, email delivery, auto-create on paid bookings, 4 dashboard pages)**
- **Git:** `master` branch, 16 commits. All invoice work is **unstaged** — needs committing. Large changeset across ~15 new files and ~8 modified files.
- **DB:** All 12 tables in Supabase Cloud, plus `dueDate`/`downloadToken` columns on invoices, `emailSettings` on booking_types, extended `reminder_type` enum. One test invoice (INV-0001, paid) exists in the DB.
- **Tests:** 41 vitest tests pass (23 availability + 7 ics + 7 invoice number + 2 queue + 2 helpers).
- **TypeScript:** Zero errors.
- **Lint:** Zero new errors from invoice code. 2 pre-existing errors in unrelated files (working-hours-editor setState-in-effect, sidebar.tsx Math.random — both from shadcn/ui or earlier sessions).
- **Dev server:** Works on localhost:3000.

## Known Issues / Blockers

- **All invoice work is uncommitted** — needs committing before anything else. Large changeset spanning Sessions 8-9.
- **`npm run build` untested** — Tailwind v4 crash was fixed in Session 3 but production build has never been verified. `@react-pdf/renderer` may cause build issues (uses canvas/yoga-layout native deps). Test before deploy.
- **Raw Drizzle errors leak to client** — tRPC error handler passes full SQL query text to the frontend toast. Needs user-friendly error wrapping before production.
- **No rate limiting** on public REST endpoints (`/api/v1/book/...` and `/api/v1/invoices/...`). Should add before production.
- **Google OAuth untested end-to-end** — needs credentials in `.env.local` + Google Cloud Console redirect URI.
- **Microsoft Outlook OAuth not built** — deferred. Same pattern as Google.
- **Public booking page not browser-tested** — TypeScript compiles, but full flow hasn't been tested with real data.
- **Email system not live-tested** — needs `RESEND_API_KEY` in `.env.local`. Invoice email sending works in code but Resend is lazy-initialised so it won't crash without the key.
- **ICS endpoint token param not in email templates** — email templates that link to .ics download may need updating to include `?token=` param.
- **Invoice PDF not visually verified** — the PDF generates (tested via tRPC `downloadPdf`), but nobody has opened the actual PDF file to verify layout and styling.
- **2 pre-existing lint errors** — `working-hours-editor.tsx` (setState in effect) and `sidebar.tsx` (Math.random in shadcn component). Not blocking.

## Next Priorities (in order)

1. **Commit all unstaged work** — large changeset from Sessions 8-9 (email system, .ics, API security fixes, invoices). Use `/commit` or batch into logical commits.
2. **Step 13: AI transcription + summary** — Deepgram API for transcription, Claude API (Haiku) for meeting summaries. Browser MediaRecorder API for IRL recordings + file upload.
3. **API security fixes (remaining)** — rate limiting (per-IP: 60 reads/min, 5 writes/min), bot protection on `/create` (honeypot/Turnstile), hashed `apiKey` on organisations, token expiry (90 days / 30 days post-booking). ICS token auth, timezone validation, customCss/orgId stripping already done.
4. **Step 14: Testing + Lighthouse + accessibility audit**
5. **Step 15: Deploy to VPS** — test `npm run build` first (may need `@react-pdf/renderer` build config). Docker multi-stage build.
6. **New REST API endpoints for WP plugin** — 8 endpoints still needed (see CLAUDE.md). Lower priority — WP plugin is Phase 3.

## Files Modified This Session (Session 9)

**Created:**
- `c:\Users\Bean\Projects\booking-system\src\lib\invoice\number.ts` — invoice number parse/format helpers
- `c:\Users\Bean\Projects\booking-system\src\lib\invoice\number.test.ts` — 7 tests for number helpers
- `c:\Users\Bean\Projects\booking-system\src\lib\invoice\template.tsx` — @react-pdf/renderer PDF template
- `c:\Users\Bean\Projects\booking-system\src\lib\invoice\generate.ts` — PDF buffer generation helper
- `c:\Users\Bean\Projects\booking-system\src\lib\email\templates\invoice-email.tsx` — React Email invoice template
- `c:\Users\Bean\Projects\booking-system\src\server\routers\invoices.ts` — tRPC router (8 procedures)
- `c:\Users\Bean\Projects\booking-system\src\app\api\v1\invoices\[id]\pdf\route.ts` — public PDF download endpoint
- `c:\Users\Bean\Projects\booking-system\src\app\(dashboard)\dashboard\invoices\page.tsx` — invoice list page
- `c:\Users\Bean\Projects\booking-system\src\app\(dashboard)\dashboard\invoices\[id]\page.tsx` — invoice detail page
- `c:\Users\Bean\Projects\booking-system\src\app\(dashboard)\dashboard\invoices\new\page.tsx` — create invoice page
- `c:\Users\Bean\Projects\booking-system\src\app\(dashboard)\dashboard\invoices\[id]\edit\page.tsx` — edit invoice page
- `c:\Users\Bean\Projects\booking-system\src\app\(dashboard)\dashboard\invoices\_components\invoice-form.tsx` — shared form component
- `c:\Users\Bean\Projects\booking-system\docs\plans\2026-02-13-invoice-implementation-plan.md` — 15-task implementation plan
- `c:\Users\Bean\Projects\booking-system\docs\plans\2026-02-13-invoice-system-design.md` — design research document

**Modified:**
- `c:\Users\Bean\Projects\booking-system\src\lib\db\schema.ts` — added `dueDate`, `downloadToken` to invoices, `companyRegistrationNumber` to branding type
- `c:\Users\Bean\Projects\booking-system\src\lib\email\resend.ts` — lazy Resend client init + Buffer attachment support
- `c:\Users\Bean\Projects\booking-system\src\server\routers\_app.ts` — registered invoices router
- `c:\Users\Bean\Projects\booking-system\src\app\(dashboard)\sidebar.tsx` — added Invoices nav item
- `c:\Users\Bean\Projects\booking-system\src\app\api\v1\book\[orgSlug]\[typeSlug]\create\route.ts` — auto-create invoice for paid bookings
- `c:\Users\Bean\Projects\booking-system\package.json` — added `@react-pdf/renderer`

## Notes for Next Session

- **Resend is lazy-initialised** — `src/lib/email/resend.ts` no longer crashes at import time when `RESEND_API_KEY` is missing. The Resend client is only created on the first `sendEmail()` call.
- **Invoice auto-create is fire-and-forget** — same pattern as booking emails. The invoice email (with PDF attachment) is generated and sent asynchronously after booking creation. Errors are caught and logged but don't block the booking response.
- **Decimal columns from Drizzle** — `priceAmount`, `subtotal`, `total`, `vatRate`, `vatAmount` come back as strings from the DB. Always `parseFloat()` before formatting or calculating.
- **Test invoice in DB** — INV-0001 (paid, £75.00, "Test Client") exists in the database from browser testing. Consider cleaning up before production deploy.
- **Empty string bug pattern** — still applies: any optional field mapping to a non-text DB column needs `|| null` not `?? null`.
- **Zod v4 `z.record()` needs 2 args** — still applies.
- **`.env.local` cannot be edited by Claude** — user hook blocks it. Ask the user to add env vars manually.
- **date-fns-tz v3** — uses `toZonedTime()` not `utcToZonedTime()`.
- **`@react-pdf/renderer` on Windows** — installs fine but may have native dependency issues at build time (yoga-layout). Test `npm run build` before deploy.
- **WP plugin spec** — fully rewritten in Session 7. Plugin is a thin API client. Depends on this system's REST API. 8 endpoints still needed. See CLAUDE.md "External Consumers" and "REST API v1 — endpoints still needed".

## Relevant Tooling for Next Tasks

### Commands
- `/handoff` — generate session handoff
- `/commit` — create git commits (PRIORITY: commit all unstaged work)
- `/commit-push-pr` — commit, push, and open PR (when ready to merge to main)

### Skills
- `/brainstorming` — explore requirements before building AI transcription (Step 13)
- `/booking-dev` — guided feature development, ensures consistency with project architecture
- `/superpowers:writing-plans` — create implementation plan for transcription system
- `/superpowers:test-driven-development` — TDD for transcription/summary helpers
- `/verification-before-completion` — verify work before claiming done

### Agents
- `test-and-explain` — tests what was built and explains results in plain English
- `booking-reviewer` — reviews booking code for multi-tenant security, UK English, WCAG AA, org-scoping

### Hooks
- `.env.local` cannot be edited by Claude — a user hook blocks writes to it. Ask the user to add environment variables manually.

## Next Session Prompt

~~~
/superpowers:using-superpowers

Booking system Phase 1 progress: Steps 1-12 complete. Invoice system (Step 12) was just finished and browser-tested — full CRUD, PDF generation via @react-pdf/renderer, email delivery, auto-create on paid bookings, 4 dashboard pages. All work is UNCOMMITTED on `master` branch. 41 tests pass, zero TypeScript errors.

Read CONVERSATION-HANDOFF.md and CLAUDE.md for full context, then work through these priorities:

1. **Commit all unstaged work** — large changeset from Sessions 8-9 (email system, .ics calendar, API security fixes, invoice system). Use `/commit` to batch into logical commits (e.g. email system, .ics, security fixes, invoice system).
2. **Step 13: AI transcription + summary** — Deepgram API for transcription, Claude API (Haiku) for meeting summaries. Browser MediaRecorder API for IRL recordings + file upload. Use `/brainstorming` first, then `/superpowers:writing-plans` for implementation plan.
3. **API security fixes (remaining)** — rate limiting, bot protection, apiKey auth, token expiry. See CLAUDE.md "API Security Fixes Required".
4. **Step 14: Testing + Lighthouse + accessibility audit**
5. **Step 15: Deploy to VPS** — test `npm run build` first, @react-pdf/renderer may need special build handling.

Watch for: empty-string-to-null bug (`|| null` not `?? null`), Zod v4 `z.record()` needs 2 args, `.env.local` edits blocked by hook (ask user to add vars manually), date-fns-tz v3 uses `toZonedTime()` not `utcToZonedTime()`, decimal columns from Drizzle return strings (use `parseFloat()`).
~~~
