# Session Handoff — 12 February 2026

## Completed This Session

1. **Critical plan review** — ran 4 parallel subagents (architecture, UI/UX, competitor analysis, risk assessment). Produced consolidated report grading plan 6/10 overall. Key findings: MVP scope is 3x too big, tRPC breaks for cross-origin embed widget, bookings table was missing org_id, OAuth tokens stored in plaintext, Docker Compose didn't include Supabase Auth, no monitoring/error tracking
2. **Agreed on reduced MVP scope** — user agreed to "start small". Revised MVP from 15 steps to phased approach: Phase 1A (6 steps: auth → booking types → working hours → Google Calendar → availability engine → public page), Phase 1B (email + deploy), Phase 1C (polish). AI transcription, invoicing, Outlook, Zoom all deferred
3. **Fixed 6 database schema issues:**
   - Added `orgId` to bookings table (denormalised from bookingType for RLS)
   - Split `calendarAccounts.calendars` JSONB into new `calendarConnections` table (indexable)
   - Added `timezone` column to `availabilityOverrides`
   - Changed bookings FKs to `ON DELETE RESTRICT` (not CASCADE)
   - Added `cancellationToken` + `rescheduleToken` to bookings for email action links
   - Renamed token columns to `accessTokenEncrypted`/`refreshTokenEncrypted`
   - Added composite index `bookings_organiser_time_idx` for availability engine
4. **Created encryption utility** — `src/lib/crypto.ts` with AES-256-GCM encrypt/decrypt for OAuth tokens
5. **Created public REST API** alongside tRPC — versioned `/api/v1/` routes for cross-origin embed widget:
   - `/api/v1/health` — UptimeRobot health check
   - `/api/v1/book/[orgSlug]/[typeSlug]/availability` — public slot availability (stub, awaits engine)
   - `/api/v1/book/[orgSlug]/[typeSlug]/create` — public booking creation with CORS
6. **Updated Docker Compose** — hybrid deployment: self-hosted Postgres + Redis on VPS, Supabase Cloud for auth/storage. Locked ports to localhost-only, added memory limits (1.5GB Postgres, 192MB Redis, 512MB app), Redis AOF persistence
7. **Added Sentry error tracking** — installed `@sentry/nextjs`, created client/server/edge configs, global error boundary, wrapped next.config.ts
8. **Updated CLAUDE.md** — documented dual API architecture (tRPC for dashboard, REST v1 for public), new table, encryption, Sentry

## Current State

- **Working:** Next.js 16 scaffolded with TypeScript, Tailwind CSS v4, shadcn/ui (27 components), Drizzle ORM schema (12 tables with relations), tRPC v11 + REST API v1, Supabase SSR auth clients, middleware, theming (6 presets), Docker Compose, Dockerfile, Sentry wiring, crypto utility
- **TypeScript:** Compiles cleanly, zero errors
- **Git:** Single initial commit from `create-next-app`. ALL work from 3 sessions is uncommitted — should be committed before continuing
- **Not deployed:** Local development only. No Supabase project connected yet (needs `.env.local`)
- **No migrations run:** Schema defined in Drizzle but no database exists yet

## Known Issues / Blockers

- **No Supabase project** — user must create one at supabase.com and add URL + keys to `.env.local`. This blocks Step 3 (auth flow)
- **No Sentry project** — user must sign up at sentry.io and add DSN to `.env.local`. Not blocking but should be done before deploy
- **Uncommitted work** — 3 sessions of changes unstaged. Risk of losing work. Commit immediately
- **`nul` file** — stray Windows artifact in project root. Delete and gitignore
- **REST API routes are stubs** — availability endpoint returns empty slots array; booking creation doesn't verify slot availability. Both will be completed when the availability engine is built (Phase 1B)
- **No rate limiting** on public REST endpoints yet — add before deploy
- **TOKEN_ENCRYPTION_KEY not generated** — user needs to run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and add to `.env.local`

## Next Priorities (in order)

1. **Commit all work** — 3 sessions of changes need to be committed before anything else
2. **Supabase project setup** (user browser task) — create project, copy credentials to `.env.local`
3. **Generate encryption key** — add TOKEN_ENCRYPTION_KEY to `.env.local`
4. **Step 3: Auth flow** — Supabase Auth with magic link login, login/register pages, OAuth callback, protected dashboard layout, onboarding wizard (connect calendar → create type → copy link)
5. **Step 4: Booking types CRUD** — simple form (NOT drag-and-drop builder), add/edit/delete booking types
6. **Step 5: Working hours setup** — per-day configuration UI
7. **Step 6: Google Calendar OAuth + sync** — single provider for MVP, encrypt tokens
8. **Step 7: Availability engine** — write tests FIRST (use `availability-engine-tester` agent), then implement. Handle timezones with care
9. **Step 8: Public booking page** — wire up the REST API stubs to the real engine
10. **Step 9: Email + cancel/reschedule links** — Resend + BullMQ reminders

## Files Modified

**Created this session:**
- `c:\Users\Bean\Projects\booking-system\src\lib\crypto.ts` — AES-256-GCM encrypt/decrypt
- `c:\Users\Bean\Projects\booking-system\src\app\api\v1\health\route.ts` — health check endpoint
- `c:\Users\Bean\Projects\booking-system\src\app\api\v1\book\[orgSlug]\[typeSlug]\availability\route.ts` — public availability API
- `c:\Users\Bean\Projects\booking-system\src\app\api\v1\book\[orgSlug]\[typeSlug]\create\route.ts` — public booking creation API
- `c:\Users\Bean\Projects\booking-system\sentry.client.config.ts` — Sentry browser config
- `c:\Users\Bean\Projects\booking-system\sentry.server.config.ts` — Sentry server config
- `c:\Users\Bean\Projects\booking-system\sentry.edge.config.ts` — Sentry edge config
- `c:\Users\Bean\Projects\booking-system\src\app\global-error.tsx` — Sentry error boundary

**Modified this session:**
- `c:\Users\Bean\Projects\booking-system\src\lib\db\schema.ts` — 6 schema fixes (org_id, calendarConnections, timezone, RESTRICT, tokens, indexes)
- `c:\Users\Bean\Projects\booking-system\src\middleware.ts` — exclude `/api/v1` from auth
- `c:\Users\Bean\Projects\booking-system\docker-compose.yml` — hybrid deployment, memory limits, localhost ports
- `c:\Users\Bean\Projects\booking-system\.env.example` — added TOKEN_ENCRYPTION_KEY + SENTRY_DSN
- `c:\Users\Bean\Projects\booking-system\next.config.ts` — Sentry wrapper
- `c:\Users\Bean\Projects\booking-system\CLAUDE.md` — updated architecture docs (dual API, 12 tables, encryption)
- `c:\Users\Bean\Projects\booking-system\package.json` — added @sentry/nextjs
- `c:\Users\Bean\Projects\booking-system\package-lock.json`

## Key Decisions Made This Session

1. **MVP scope reduced** — original 15-step MVP cut to phased 1A/1B/1C. AI transcription, invoicing, Outlook, Zoom, drag-and-drop form builder, in-person bookings all deferred to Phase 2+
2. **Dual API architecture** — tRPC for authenticated dashboard (same-origin), REST v1 for public booking/embed (cross-origin with CORS). Shared business logic underneath
3. **Hybrid deployment** — Supabase Cloud for auth + file storage (handles JWT, magic links). Self-hosted Postgres + Redis on VPS. Avoids running full Supabase Docker stack (4-6GB RAM)
4. **OAuth tokens encrypted** — AES-256-GCM with environment variable key. Never stored in plaintext
5. **Bookings denormalised** — org_id added directly to bookings table for RLS and fast queries
6. **Calendar data normalised** — JSONB calendars array split into calendarConnections table for indexing
7. **No pivot needed** — all issues from the critical review have workarounds, no tech stack changes required

## Notes for Next Session

- **User is a non-coder with ADHD** — clear numbered lists, one recommendation with reasoning, no praise/encouragement, UK English always
- **Commit first** — 3 sessions of uncommitted work. Do this immediately
- **Supabase signup is the blocker** — user needs to do this in browser before auth can be built. Offer to guide with browser automation skill
- **Test continuously** — don't batch testing at the end. Use `availability-engine-tester` agent after building the engine. Use `test-and-explain` agent after each feature
- **Form builder is simple CRUD for MVP** — add fields via dropdown + up/down reorder. Drag-and-drop is Phase 2 polish
- **Add onboarding wizard** to auth flow — 3 steps: connect calendar → create booking type → copy link
- **Cancel/reschedule links are in MVP** — tokens already in schema, build the routes when doing email step
- **Brand:** Small Giants Studio, #1B6B6B primary (teal), #E8B931 accent (gold), Inter font, Europe/London, GBP
- **The `reference/` folder** contains full planning context. The txt file is 266KB — use offset/limit or grep
- **Critical review report** was delivered in conversation (not saved to file). Key grade: 6/10 overall. Top weaknesses: bloated MVP scope, missing org_id, plaintext tokens, no monitoring — all now fixed
