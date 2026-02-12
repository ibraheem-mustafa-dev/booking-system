# Self-Hosted Booking/Scheduling System — Implementation Plan

## Context

Small Giants Studio needs a self-hosted booking system that:
- Replaces Calendly/Acuity with something faster, more customisable, and self-owned
- Handles both online meetings and in-person appointments/events
- Syncs 5+ Google/Outlook calendars with granular "busy" override control
- Embeds on WordPress sites without the 370ms render-blocking delay Calendly causes
- Is designed from day one to be white-labelled for clients and eventually offered as SaaS

**Market gap confirmed by research:** No existing tool combines fast embeds + WordPress-native integration + schema markup + granular multi-calendar control + flat-rate pricing + post-booking automation. Cal.com is the closest open-source option but its AGPLv3 licence kills the white-label/SaaS business model, and self-hosting it is documented as genuinely painful.

**Decision: Custom build.** Not a fork. Full ownership, full control, purpose-built for the differentiators.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js 15 (App Router) | SSR + API routes + serverless-compatible. Best React docs coverage for Claude-assisted dev |
| **Database** | Supabase (PostgreSQL) | Auth, RLS for multi-tenant isolation, real-time subscriptions, file storage, self-hostable via Docker |
| **ORM** | Drizzle ORM | Lighter than Prisma, edge-compatible, type-safe |
| **API** | tRPC | End-to-end type safety between frontend and backend |
| **UI** | Tailwind CSS + shadcn/ui | Rapid, accessible component library. Fully customisable |
| **Embed Widget** | Lit Web Component (~5KB gzipped) | Shadow DOM isolation, framework-agnostic, works on any platform |
| **Email** | Resend + React Email | Type-safe templates, 3,000 free/month, modern DX |
| **Job Queue** | BullMQ + Redis | Reminder scheduling, follow-up emails, retry logic |
| **Payments** | Stripe Connect (Phase 2) | Multi-tenant payment splitting, handles KYC |
| **Video** | Google Meet + Zoom + Microsoft Teams (organiser chooses per booking type) |
| **AI Transcription** | Deepgram API | 1hr audio in 20 seconds, no GPU needed |
| **AI Summary** | Claude API (Haiku) | Structured extraction of action items, decisions, follow-ups |
| **Hosting** | Existing Hostinger KVM 2 VPS (8GB RAM) via Docker Compose | Alongside N8N. No extra cost |

---

## UI Design & Theming System

### Design Principles
- **Beautiful by default** — polished, modern UI that looks premium out of the box. Not a developer tool aesthetic. Think SavvyCal's elegance, not Cal.com's utilitarian look
- **Mobile-first responsive** — every screen designed for mobile first, scaled up. Breakpoints: 375px (mobile), 768px (tablet), 1024px (desktop), 1440px (wide)
- **44px minimum touch targets** — WCAG 2.2 AA throughout
- **Smooth micro-interactions** — subtle transitions on hover, focus, and state changes (Framer Motion for React components, CSS transitions for the Lit widget)
- **Dark mode support** — system preference detection + manual toggle

### Theming Architecture
Each organisation gets a fully customisable theme stored in the `organisations.branding` JSON column:

```json
{
  "logo_url": "...",
  "favicon_url": "...",
  "primary_colour": "#1B6B6B",
  "accent_colour": "#E8B931",
  "text_colour": "#1a1a1a",
  "background_colour": "#ffffff",
  "font_family": "Inter",
  "border_radius": "md",
  "button_style": "rounded",
  "dark_mode": { "primary_colour": "#...", "background_colour": "#..." },
  "custom_css": ""
}
```

- **CSS custom properties** — theme values injected as `--brand-primary`, `--brand-accent`, etc. at runtime. All components reference these variables, not hardcoded colours
- **Font selection** — preset options (Inter, DM Sans, Playfair Display, Poppins, Plus Jakarta Sans) loaded via `next/font` for zero layout shift. Covers clean/corporate, creative/playful, and elegant/luxury styles
- **Border radius presets** — none, sm, md, lg, full (pill). Changes the entire feel from sharp/corporate to soft/friendly
- **Button style presets** — solid, outline, ghost, gradient. Each applies consistently across all interactive elements
- **Pre-built style presets** — one-click themes for common niches:
  - **Corporate** (navy + grey, Inter, sharp corners)
  - **Creative** (bold colours, DM Sans, rounded)
  - **Wellness** (soft greens + earth tones, Poppins, pill buttons)
  - **Events** (vibrant accent, Plus Jakarta Sans, gradient buttons)
  - **Luxury** (dark + gold, Playfair Display, minimal)
  - **Custom** (full control over every value)

### Public Booking Page Design
- Clean step-by-step flow with progress indicator
- Large, tappable date picker (not a cramped mini-calendar)
- Time slots as clear pill buttons with timezone shown
- Form fields with floating labels, clear validation messages
- Confirmation page with all details + calendar add buttons prominently placed
- Animated transitions between steps (not jarring page reloads)
- Loading skeleton states (not spinners)

### Admin Dashboard Design
- Sidebar navigation (collapsible on mobile)
- Calendar view uses a proper calendar grid component (not a table)
- Data tables with sorting, filtering, search
- Stats cards with subtle sparkline charts
- Drag-and-drop for form builder fields
- Live preview panel when editing branding/themes
- Toast notifications for actions (not alert boxes)

### Embed Widget Design
- Inherits host organisation's theme via CSS custom properties
- Adapts to container width (not fixed breakpoints)
- Popup mode: centred modal with backdrop blur, smooth entry animation
- Inline mode: renders directly, respects parent container's max-width
- Minimal UI chrome — feels native to the host site, not a foreign embed

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    VPS (Docker Compose)              │
│  ┌──────────┐  ┌──────────┐  ┌───────┐  ┌───────┐  │
│  │ Next.js  │  │ Supabase │  │ Redis │  │  N8N  │  │
│  │  App     │  │ (PG+Auth)│  │       │  │(exists)│  │
│  └────┬─────┘  └────┬─────┘  └───┬───┘  └───────┘  │
│       │              │            │                   │
│       └──────────────┴────────────┘                   │
│              Internal Docker Network                  │
└─────────────────────────────────────────────────────┘
        │
        │ HTTPS (reverse proxy)
        ▼
┌───────────────┐     ┌──────────────────┐
│  Public Web   │     │  Lit Widget       │
│  Booking Page │     │  (~5KB embed)     │
│  /book/[slug] │     │  <booking-widget> │
└───────────────┘     └──────────────────┘
        │                     │
        ▼                     ▼
┌───────────────────────────────────────┐
│         WordPress / Any Website       │
│  Inline widget  |  Popup/modal mode   │
└───────────────────────────────────────┘
```

### Multi-Calendar Availability Engine (Core Differentiator)

```
Available Slots = Working Hours
  MINUS  Calendar Busy Events (Google + Outlook + Apple)
  PLUS   Manual "Open Anyway" Overrides
  MINUS  Manual "Blocked" Overrides
  MINUS  Existing Bookings
  MINUS  Buffer Time (configurable, default 15 min)
```

Database table: `availability_overrides`
- `id`, `user_id`, `date`, `start_time`, `end_time`
- `type`: `available` (open even when calendar says busy) or `blocked` (closed even when calendar says free)
- `reason` (optional note, e.g. "mosque event but can take calls")
- `recurring` (optional: weekly pattern, e.g. "every Friday after 15:00")

---

## Phased Implementation

### Phase 1 — MVP (Build First, Use Immediately)

**Scope:** Public booking page + multi-calendar sync + granular availability + email confirmations + timezone detection + basic admin dashboard. Both online and in-person booking types.

#### 1.1 Project Setup
- Next.js 15 project with App Router, TypeScript, Tailwind, shadcn/ui
- Supabase self-hosted via Docker Compose on VPS (alongside N8N)
- Redis container for BullMQ
- Drizzle ORM + tRPC setup
- Reverse proxy config (Caddy or Nginx)
- Brand theming: #1B6B6B primary, #E8B931 accent, Small Giants Studio logo

#### 1.2 Authentication & User Management
- Supabase Auth (email + magic link)
- Admin user (you) with full dashboard access
- Multi-tenant user model from day one (even if only you use it initially)
- Row-Level Security policies on all tables

#### 1.3 Booking Types Configuration
- CRUD for booking types (admin dashboard)
- Fields: name, duration (default 30 min), description, location type (online/in-person), buffer time, max advance booking window, min notice period
- Online: auto-generate video meeting link (Google Meet / Zoom / Microsoft Teams — organiser chooses)
- In-person: address/location field with optional Google Maps embed
- Each type gets a unique slug: `/book/[user-slug]/[type-slug]`
- Colour coding per type
- **Custom form fields per booking type:** Host configures what details to collect (e.g. company name, project brief, dietary requirements, accessibility needs). Field types: text, textarea, select, checkbox, radio, file upload. Fields marked required/optional. Stored as JSON schema on `booking_types`, rendered dynamically on booking page

#### 1.4 Availability Engine
- Working hours configuration (per day of week, with timezone)
- Google Calendar OAuth integration (read free/busy from multiple calendars)
- Microsoft Graph API integration (Outlook calendars, same approach)
- `availability_overrides` table for manual open/blocked slots
- Recurring overrides (e.g. "every Friday after 15:00 — blocked")
- Real-time availability calculation combining all sources
- Webhook listeners + polling fallback (every 5 min) for calendar changes

#### 1.5 Public Booking Page
- Clean, responsive booking flow: select type → pick date → pick time → enter details → confirm
- Automatic timezone detection (client-side) with manual override option
- Mobile-first, WCAG 2.2 AA accessible (44px touch targets)
- Branded with Small Giants Studio colours and logo
- Fast: server-side rendered first available date, client hydration for interaction

#### 1.6 Email Notifications
- Resend + React Email templates
- Booking confirmation (to both organiser and client)
- New booking notification (to organiser)
- 24-hour reminder (to both)
- 1-hour reminder (to both)
- BullMQ delayed jobs for reminders (auto-cancelled if booking cancelled)
- Calendar attachment (.ics file) in confirmation email
- "Add to Google Calendar" / "Add to Apple Calendar" / "Add to Outlook" / "Download .ics" links

#### 1.7 Admin Dashboard
- View all upcoming and past bookings
- Calendar view (day/week/month)
- Manage availability overrides (the "open anyway" / "blocked" granular control)
- Manage booking types
- Connect/disconnect calendar accounts
- Basic analytics: bookings this week/month, no-show rate

#### 1.8 Basic AI (Transcription + Summary)
- Post-meeting: upload recording or paste meeting link
- Deepgram API transcription
- Claude API (Haiku) summary: key points, action items, decisions
- Organiser controls whether to share summary with client
- Works for online meetings (auto-capture recording)
- **Works for in-person meetings/events via phone:** Upload audio file recorded on phone, or use a mobile-friendly "record now" button in the dashboard that uses the phone's microphone via the browser's MediaRecorder API. No native app needed for MVP — progressive web app (PWA) approach
- Stored securely in Supabase Storage, accessible from booking detail view

#### 1.9 Invoices & Receipts
- **Branded/customised invoices and receipts** — generated as PDF from React Email-style templates
- Organiser branding (logo, colours, company details, VAT number) pulled from organisation settings
- Auto-generated when a paid booking is confirmed (even before Stripe is integrated — manual "mark as paid" for MVP)
- Sent to client via email with PDF attachment
- Fields: invoice number (auto-incrementing), date, booking details, line items, amount, payment status, VAT if applicable
- Downloadable from both admin dashboard and client booking confirmation page
- Template customisable by host (e.g. add terms & conditions, payment instructions, bank details for BACS transfer)
- Receipts auto-sent on payment confirmation

---

### Phase 2 — Monetisation & Teams

- Stripe Connect integration (per booking type: free, paid, or deposit)
- Cancellation/reschedule links in confirmation emails
- Cancellation policies (configurable per booking type)
- Refund handling
- Multiple team members with separate booking pages
- Round-robin and collective booking (team features)
- Contact form integration

---

### Phase 3 — WordPress Embed & White-Label

- Lit Web Component (`<booking-widget>`) — ~5KB gzipped
- Shadow DOM for style isolation
- IntersectionObserver for lazy loading (zero cost until visible)
- Two modes: inline widget + popup/modal
- WordPress plugin: `[booking]` shortcode + Gutenberg block
- White-label: custom domain, custom branding per tenant
- Multi-tenant onboarding flow

---

### Phase 4 — Advanced Features

- AI booking assistant (conversational: "find me a slot Tuesday afternoon")
- Follow-up email sequences (review requests, rebooking nudges)
- JSON-LD schema markup (LocalBusiness, Service, Event, Schedule)
- Spam protection (invisible CAPTCHA, rate limiting)
- Mollie payment gateway (EU local payment methods)
- Apple Calendar (CalDAV) integration
- Waiting lists
- Recurring appointments
- Group bookings / event ticketing
- N8N webhook integration for custom automation
- SMS reminders via Twilio

### Phase 5 — Events & Mobile

- **QR code tickets for in-person events:** Auto-generated unique QR code per booking, sent via email and downloadable. Contains booking ID, event details, attendee name
- **Mobile scanning app (PWA):** Progressive web app for organisers to scan QR codes at the door for attendance tracking. Uses phone camera via browser — no App Store submission needed. Real-time attendance dashboard showing checked-in vs. expected
- **Native mobile app (optional future):** React Native wrapper if PWA limitations become an issue (e.g. background scanning, push notifications)

---

## Key Differentiators vs. Competitors

| Feature | Calendly | Cal.com | Amelia | This System |
|---------|----------|---------|--------|-------------|
| Embed load time | ~370ms blocking | ~200ms | Heavy | ~5KB, near-zero blocking |
| Multi-calendar granular control | Basic busy/free | Per-date overrides | None | Full override engine with recurring rules |
| Schema markup / SEO | None | None | None | Auto-generated JSON-LD |
| Self-hosted | No | Yes (painful) | No (WordPress only) | Yes (Docker, easy) |
| White-label | Logo only | Paid plan | No | Full: domain, branding, everything |
| Licence restrictions | Proprietary | AGPLv3 (must open-source mods) | Proprietary | Yours. Full ownership |
| AI features | None | None | None | Transcription + summary + assistant |
| WordPress integration | Slow iframe | iframe | PHP plugin (heavy) | Native Web Component (~5KB) |
| Pricing model (for clients) | Per-seat/month | Per-seat or self-host | One-time + addons | Flat-rate or white-label |

---

## Database Schema (Core Tables — Phase 1)

```
users              — id, email, name, timezone, avatar_url, created_at
organisations      — id, name, slug, branding (JSON: logo, colours, company_name, address, vat_number, terms), owner_id
org_members        — id, org_id, user_id, role
calendar_accounts  — id, user_id, provider (google/outlook/apple), access_token, refresh_token, email, calendars (JSON)
booking_types      — id, org_id, name, slug, duration_mins, buffer_mins, description, location_type, location_details, colour, video_provider, is_active, max_advance_days, min_notice_hours, custom_fields (JSON schema for form builder), price_amount, price_currency, requires_payment
working_hours      — id, user_id, day_of_week, start_time, end_time, timezone
availability_overrides — id, user_id, date, start_time, end_time, type (available/blocked), reason, is_recurring, recurrence_rule
bookings           — id, booking_type_id, organiser_id, client_name, client_email, client_phone, client_timezone, start_at, end_at, status (confirmed/cancelled/completed/no_show), video_link, location, notes, custom_field_responses (JSON), qr_code_token (unique), checked_in_at, created_at
booking_reminders  — id, booking_id, type (24h/1h/custom), scheduled_at, sent_at, job_id
meeting_recordings — id, booking_id, transcript_text, summary_text, summary_shared, recording_url, recorded_via (online/phone_upload/browser_mic), created_at
invoices           — id, booking_id, org_id, invoice_number, client_name, client_email, line_items (JSON), subtotal, vat_rate, vat_amount, total, currency, payment_status (pending/paid/refunded), payment_method, paid_at, pdf_url, notes, created_at
```

All tables have RLS policies scoped to `org_id` for multi-tenant isolation.

---

## Verification & Testing

1. **Local development:** `docker compose up` runs everything locally
2. **Availability engine:** Unit tests for the slot calculation logic (working hours ± overrides ± bookings ± buffer)
3. **Calendar sync:** Integration tests with Google Calendar sandbox and Microsoft Graph test accounts
4. **Booking flow:** End-to-end test: client visits page → selects slot → submits → receives confirmation email → organiser sees booking in dashboard
5. **Email delivery:** Resend test mode for development, verify templates render correctly
6. **Embed widget:** Test on a WordPress staging site — measure load time, verify Shadow DOM isolation, test both inline and popup modes
7. **AI transcription:** Upload a test recording → verify transcript → verify summary generation
8. **Performance:** Lighthouse audit on public booking page (target: 95+ performance score)
9. **Accessibility:** axe-core audit (WCAG 2.2 AA compliance)
10. **Mobile:** Test on actual devices (Android + iOS) at various viewport widths

---

## Files & Directories to Create

```
booking-system/
├── docker-compose.yml          # Next.js + Supabase + Redis
├── Dockerfile                  # Next.js standalone build
├── .env.example                # All required env vars documented
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Login, register, OAuth callbacks
│   │   ├── (dashboard)/        # Admin dashboard routes
│   │   │   ├── bookings/       # Booking list, detail, calendar view
│   │   │   ├── booking-types/  # CRUD + custom form builder
│   │   │   ├── availability/   # Working hours, overrides, calendar connections
│   │   │   ├── invoices/       # Invoice list, create, PDF preview
│   │   │   ├── recordings/     # Transcription uploads, summaries
│   │   │   └── settings/       # Organisation branding, integrations
│   │   ├── book/[slug]/        # Public booking pages
│   │   └── api/                # tRPC + webhook endpoints
│   ├── components/             # shadcn/ui + custom components
│   │   ├── form-builder/       # Dynamic form field editor (admin) + renderer (public)
│   │   └── invoice/            # Invoice PDF template + preview
│   ├── lib/
│   │   ├── availability/       # Core availability engine
│   │   ├── calendar/           # Google, Outlook, Apple integrations
│   │   ├── email/              # React Email templates + Resend
│   │   ├── invoice/            # PDF generation (react-pdf or @react-pdf/renderer)
│   │   ├── ai/                 # Deepgram + Claude integrations
│   │   ├── qr/                 # QR code generation (Phase 5)
│   │   └── db/                 # Drizzle schema + migrations
│   ├── server/                 # tRPC routers
│   └── widget/                 # Lit Web Component source
├── wordpress-plugin/           # WP plugin for [booking] shortcode
├── supabase/                   # Supabase config, migrations, seed
└── tests/                      # Unit + integration + e2e tests
```

---

## Estimated Resource Usage on VPS (8GB RAM)

| Service | RAM | Notes |
|---------|-----|-------|
| N8N (existing) | ~512MB | Already running |
| Supabase (PG + Auth + REST) | ~1.5GB | PostgreSQL is the heavy part |
| Next.js App | ~256MB | Standalone Node.js build |
| Redis | ~50MB | Lightweight, for BullMQ |
| Docker overhead | ~200MB | |
| **Total** | **~2.5GB** | **Leaves ~5.5GB free** — comfortable |

---

## Timeline Approach

No time estimates (per your preferences). Build order is:
1. Docker Compose + Supabase + project scaffolding
2. Database schema + Drizzle migrations
3. Auth flow (Supabase Auth)
4. Booking types CRUD + custom form builder (admin dashboard)
5. Working hours + availability overrides (admin dashboard)
6. Google Calendar OAuth + sync
7. Microsoft Outlook OAuth + sync
8. Availability calculation engine
9. Public booking page (with dynamic custom forms per booking type)
10. Email confirmations + reminders (Resend + BullMQ)
11. Calendar file (.ics) generation + "Add to Calendar" links
12. Invoices & receipts (branded PDF generation + email delivery)
13. AI transcription + summary (including phone upload / browser mic for IRL)
14. Testing + Lighthouse + accessibility audit
15. Deploy to VPS

Each step is a self-contained deliverable. You can start using the system after step 12 (invoices complete).
