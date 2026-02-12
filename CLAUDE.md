# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Self-hosted booking/scheduling system for Small Giants Studio. Custom-built (not a fork) to replace Calendly/Acuity with full ownership, designed from day one for multi-tenant white-label SaaS.

**Why custom-built:** Cal.com's AGPLv3 licence forces open-sourcing modifications (kills white-label/SaaS model). Calendly embeds cause 370ms render-blocking delay. No existing tool combines fast embeds + WordPress-native integration + schema markup + granular multi-calendar control + post-booking automation.

**Core differentiator:** Granular multi-calendar availability engine — "yes there's an event at 1pm but I can still take calls" level of control, with recurring override rules.

## Reference Documents

- [reference/base-claude-plan.md](reference/base-claude-plan.md) — approved implementation plan with phased roadmap, architecture diagrams, and database schema
- [reference/34f63a1c-aa5c-4b3e-a191-3b6b6a24c901.txt](reference/34f63a1c-aa5c-4b3e-a191-3b6b6a24c901.txt) — full original planning conversation with research findings, user decisions, and all requirements context

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build (standalone output for Docker)
npm run lint         # ESLint (flat config, Next.js rules)
npm start            # Start production server

# Database (Drizzle ORM)
npx drizzle-kit generate    # Generate migration from schema changes
npx drizzle-kit migrate     # Run pending migrations
npx drizzle-kit push        # Push schema directly (dev only)
npx drizzle-kit studio      # Visual database browser

# Docker (production deployment on VPS)
docker compose up -d         # Start all services (app + postgres + redis)

# shadcn/ui
npx shadcn@latest add <component-name>   # Add new UI component
```

## Tech Stack

- **Next.js 16** (App Router) with React 19 and TypeScript
- **Supabase** for auth (email + magic link) and file storage — `@supabase/ssr` for cookie-based sessions. Supabase Cloud for both dev and production auth/storage; self-hosted PostgreSQL + Redis on VPS for data
- **Sentry** for error tracking — `@sentry/nextjs` with client, server, and edge configs
- **Drizzle ORM** with `postgres` driver (not Prisma) — schema at [src/lib/db/schema.ts](src/lib/db/schema.ts)
- **tRPC v11** with superjson transformer — end-to-end type safety
- **Tailwind CSS v4** (PostCSS plugin, not CLI) with **shadcn/ui** (new-york style, Radix UI primitives)
- **BullMQ + Redis** for job queue (reminders, email scheduling)
- **Resend + React Email** for transactional email (7 template types: confirmation, notification, 24h reminder, 1h reminder, cancellation, reschedule, payment receipt)
- **Zod v4** for validation
- **Framer Motion** for React animations, CSS transitions for embed widget
- **date-fns** for date manipulation
- **Video integrations:** Google Meet + Zoom + Microsoft Teams (NOT Jitsi) — organiser chooses per booking type
- **AI:** Deepgram API for transcription, Claude API (Haiku) for meeting summaries
- **Hosting:** Existing Hostinger KVM 2 VPS (8GB RAM) via Docker Compose alongside N8N. No Docker available locally — use Supabase Cloud for dev

## Architecture

### Path Aliases
`@/*` maps to `./src/*` — all imports use this alias.

### Database Layer
- Schema: [src/lib/db/schema.ts](src/lib/db/schema.ts) — single file, all tables with Drizzle relations
- Connection: [src/lib/db/index.ts](src/lib/db/index.ts) — exports `db` instance with connection pooling (max 10)
- Migrations output to `./supabase/migrations/` (Drizzle Kit config in [drizzle.config.ts](drizzle.config.ts))
- All IDs are text UUIDs generated via `crypto.randomUUID()`
- 12 tables: `users`, `organisations`, `orgMembers`, `calendarAccounts`, `calendarConnections`, `bookingTypes`, `workingHours`, `availabilityOverrides`, `bookings`, `bookingReminders`, `meetingRecordings`, `invoices`
- `calendarConnections` split from JSONB for indexing (isSelected, externalId)
- `bookings.orgId` denormalised from bookingType for direct RLS and fast org-scoped queries
- `bookings` uses `ON DELETE RESTRICT` (not CASCADE) to prevent accidental data loss
- `bookings.cancellationToken` + `rescheduleToken` for email action links
- OAuth tokens encrypted at rest via AES-256-GCM ([src/lib/crypto.ts](src/lib/crypto.ts))
- JSONB columns for flexible data: `organisations.branding`, `bookingTypes.customFields`, `bookings.customFieldResponses`, `invoices.lineItems`

### Availability Engine (Core Differentiator)
```
Available Slots = Working Hours
  MINUS  Calendar Busy Events (Google + Outlook + Apple)
  PLUS   Manual "Open Anyway" Overrides
  MINUS  Manual "Blocked" Overrides
  MINUS  Existing Bookings
  MINUS  Buffer Time (configurable, default 15 min)
```
Override examples: "mosque event but can take calls" (type: available), "every Friday after 15:00" (recurring blocked). Stored in `availability_overrides` with optional iCal RRULE format for recurrence.

### API Layer (Dual: tRPC + REST)
**tRPC** — for the authenticated admin dashboard (same-origin, cookie auth):
- Server setup: [src/server/trpc.ts](src/server/trpc.ts) — defines context, procedures, and middleware
- Root router: [src/server/routers/_app.ts](src/server/routers/_app.ts) — add new routers here (bookingTypes, availability, bookings, calendar, invoices, recordings, settings)
- HTTP handler: [src/app/api/trpc/[trpc]/route.ts](src/app/api/trpc/[trpc]/route.ts)
- Client hook: [src/lib/trpc/client.ts](src/lib/trpc/client.ts) — `trpc` object for React components
- Provider: [src/lib/trpc/provider.tsx](src/lib/trpc/provider.tsx) — wraps app with QueryClient + tRPC client
- Three procedure levels:
  - `publicProcedure` — no auth required
  - `protectedProcedure` — requires authenticated user
  - `orgProcedure` — requires authenticated user AND organisation membership

**REST API v1** — for public booking pages and cross-origin embed widget:
- Base path: `/api/v1/`
- Health check: [src/app/api/v1/health/route.ts](src/app/api/v1/health/route.ts) — for UptimeRobot monitoring
- Availability: `/api/v1/book/[orgSlug]/[typeSlug]/availability?date=YYYY-MM-DD&timezone=...`
- Create booking: `/api/v1/book/[orgSlug]/[typeSlug]/create` (POST)
- All REST routes return CORS headers (`Access-Control-Allow-Origin: *`) for embed widget
- Versioned from day one — deployed widgets must not break on API changes

### Authentication & Middleware
- Supabase SSR client split into three files:
  - [src/lib/supabase/client.ts](src/lib/supabase/client.ts) — browser client (`'use client'`)
  - [src/lib/supabase/server.ts](src/lib/supabase/server.ts) — server component client (async, reads cookies)
  - [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts) — session refresh + route protection
- [src/middleware.ts](src/middleware.ts) runs on all routes except static files, images, `/api/trpc`, `/api/v1`, and `/book` (public booking pages)
- Dashboard routes (`/dashboard/*`) redirect to `/login` if unauthenticated
- Multi-tenant: user's primary organisation resolved in tRPC context via `orgMembers` table
- RLS policies scoped to `org_id` for multi-tenant data isolation

### Theming System
- Per-organisation branding stored as JSONB on `organisations.branding` column
- Theme config types and presets: [src/lib/theme/config.ts](src/lib/theme/config.ts)
- CSS custom properties (`--brand-primary`, `--brand-accent`, `--brand-text`, `--brand-background`, `--brand-font`, `--brand-radius`) injected at runtime on booking pages
- Six pre-built presets for niches: small-giants, corporate, creative, wellness, events, luxury
- Five font families loaded via `next/font` in root layout: Inter, DM Sans, Playfair Display, Poppins, Plus Jakarta Sans
- Dark mode via `next-themes` (class-based, system preference default)
- Brand colours: #1B6B6B primary (teal), #E8B931 accent (gold)

### UI Components
- shadcn/ui config: [components.json](components.json) — new-york style, lucide icons, Radix UI
- All UI primitives in [src/components/ui/](src/components/ui/) (27 components installed)
- Utility: [src/lib/utils.ts](src/lib/utils.ts) — `cn()` helper (clsx + tailwind-merge)
- Toast notifications via Sonner (not alert boxes)
- Global CSS enforces 44px min touch targets for WCAG 2.2 AA
- Design goal: "beautiful by default" — SavvyCal's elegance, not Cal.com's utilitarian look. Skeleton loading states, not spinners. Animated step transitions on booking flow

### Planned Directory Structure
```
src/app/
  (auth)/             # Login, register, OAuth callbacks
  (dashboard)/        # Admin dashboard routes
    bookings/         # Booking list, detail, calendar view
    booking-types/    # CRUD + custom form builder
    availability/     # Working hours, overrides, calendar connections
    invoices/         # Invoice list, create, PDF preview
    recordings/       # Transcription uploads, summaries
    settings/         # Organisation branding, integrations
  book/[slug]/        # Public booking pages
  api/                # tRPC + webhook endpoints
src/components/
  form-builder/       # Dynamic form field editor (admin) + renderer (public)
  invoice/            # Invoice PDF template + preview
src/lib/
  availability/       # Core availability engine
  calendar/           # Google, Outlook, Apple integrations
  email/              # React Email templates + Resend
  invoice/            # PDF generation
  ai/                 # Deepgram + Claude integrations
  qr/                 # QR code generation (Phase 5)
src/widget/           # Lit Web Component source (Phase 3)
wordpress-plugin/     # WP plugin for [booking] shortcode (Phase 3)
```

### Deployment
- Docker multi-stage build: [Dockerfile](Dockerfile) (Node 22 Alpine, standalone output)
- [docker-compose.yml](docker-compose.yml) runs Next.js + PostgreSQL 16 + Redis 7 on existing VPS alongside N8N
- Estimated ~2.5GB RAM usage, leaves ~5.5GB free on 8GB VPS
- Production env: `.env.production` (not committed)

## Service Dashboards

- **Supabase:** https://supabase.com/dashboard/project/wimrjgrujprvwbsewqrq (eu-west-2 London, Free tier)
- **Sentry:** https://small-giants-studio.sentry.io (EU region, org: `small-giants-studio`, project: `javascript-nextjs`)
- **UptimeRobot:** https://dashboard.uptimerobot.com (no monitors yet — add at deploy)
- **All credentials** are in `.env.local` (gitignored). See `.env.example` for the template.

## Environment Variables

Copy `.env.example` to `.env.local`. Required for dev:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `DATABASE_URL` — PostgreSQL connection string for Drizzle
- `REDIS_URL` — Redis for BullMQ

Optional (enable as features are built):
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Calendar OAuth
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` — Outlook OAuth
- `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` — Zoom OAuth
- `RESEND_API_KEY` — transactional email
- `DEEPGRAM_API_KEY` — AI transcription
- `ANTHROPIC_API_KEY` — AI meeting summaries

## Phased Build Plan

### Phase 1 — MVP (15 steps, usable after step 12)
1. ~~Project scaffolding + Docker Compose~~ (done)
2. ~~Database schema + Drizzle migrations~~ (done)
3. ~~Auth flow (Supabase Auth, magic link login)~~ (done)
4. ~~Booking types CRUD + custom form builder~~ (done)
5. ~~Working hours + availability overrides~~ (done)
6. ~~Google Calendar OAuth + sync~~ (done)
7. Microsoft Outlook OAuth + sync
8. ~~Availability calculation engine~~ (done — pure function with 23 tests)
9. ~~Public booking page (with dynamic custom forms)~~ (done)
10. Email confirmations + reminders (Resend + BullMQ)
11. Calendar file (.ics) generation + "Add to Calendar" links
12. Invoices & receipts (branded PDF generation + email delivery)
13. AI transcription + summary (including phone upload / browser mic for IRL)
14. Testing + Lighthouse + accessibility audit
15. Deploy to VPS

### Phase 2 — Monetisation & Teams
Stripe Connect, cancellation/reschedule links, team members, round-robin booking

### Phase 3 — WordPress Embed & White-Label
Lit Web Component (~5KB gzipped), Shadow DOM, WordPress plugin (`[booking]` shortcode + Gutenberg block), custom domains per tenant

### Phase 4 — Advanced Features
AI booking assistant, follow-up email sequences, JSON-LD schema markup, spam protection, Mollie payments, Apple Calendar (CalDAV), waiting lists, recurring appointments, group bookings, N8N webhooks, SMS reminders

### Phase 5 — Events & Mobile
QR code tickets for in-person events, PWA scanner app for attendance, optional React Native wrapper

## Key MVP Features (Non-Obvious)

- **Custom form fields per booking type:** Host configures what to collect (company name, dietary requirements, accessibility needs). Field types: text, textarea, select, checkbox, radio, file upload, email, phone, number. Stored as JSON schema on `booking_types.customFields`
- **Branded invoices & receipts:** PDF generation with org branding (logo, colours, company details, VAT number). Auto-generated on payment, downloadable from dashboard and client page. Template customisable (terms, payment instructions, bank details for BACS)
- **IRL transcription via phone:** Browser MediaRecorder API for recording on phone mic, plus audio file upload. No native app needed — PWA approach
- **Both online and in-person booking types:** Online gets auto-generated video meeting link, in-person gets address/location field
- **Booking types have unique slugs:** `/book/[org-slug]/[type-slug]`
- **Middleware excludes `/book` routes** from auth — public booking pages are unauthenticated

## Conventions

- UK English in all code, comments, and user-facing text (colour, organisation, cancelled, etc.) — CSS properties like `color` are the exception
- Organisation branding uses UK spelling in column names (e.g. `primaryColour`, `accentColour`)
- All timestamps use `withTimezone: true`
- Default timezone is `Europe/London`
- Default currency is `GBP`
- All components reference `--brand-*` CSS custom properties, not hardcoded colours
- Mobile-first responsive: breakpoints 375px, 768px, 1024px, 1440px
- 44px minimum touch targets throughout (WCAG 2.2 AA)
