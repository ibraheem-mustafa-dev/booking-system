# PRD: Recording Summary Share Page (Client-Facing)

**Status:** Approved — build it

## Goal
When a host enables "Share summary with client" on a recording, the client can view the AI summary at a public URL — no login required. The shared link can be sent manually or auto-included in a follow-up email.

## User Stories
- As a **host**, I toggle "Share summary with client" on a recording and get a shareable link
- As a **client**, I open the link and see the meeting summary, key points, and action items
- As a **client**, I can tick off action items assigned to me
- As a **host**, I can see which clients have viewed their shared summary

## Implementation Plan

### 1. Schema additions to meetingRecordings
In `src/lib/db/schema.ts`, meetingRecordings table — add if missing:
- `shareToken: text('share_token')` — unique UUID, generated when sharing is first enabled
- `sharedViewedAt: timestamp('shared_viewed_at', { withTimezone: true })` — set on first client view

Run `npx drizzle-kit generate` after schema changes.

### 2. Update toggleSummarySharing mutation
In `src/server/routers/recordings.ts`, `toggleSummarySharing`:
- When `shared = true`: generate a shareToken if one doesn't exist yet
- Return the shareToken in the response so the frontend can display the link

### 3. Update recording detail page — share link display
In `src/app/(dashboard)/dashboard/recordings/[id]/page.tsx`:
When `summaryShared = true`, show the shareable URL below the toggle:
```
https://[APP_URL]/share/recording/[shareToken]
```
With a copy-to-clipboard button.

### 4. Public summary page
`src/app/share/recording/[token]/page.tsx` — public, no auth

**Route handler:** loads recording by shareToken
- If not found or summaryShared = false: show "This summary is not available"
- If found: sets sharedViewedAt if not already set, renders summary

**Page content:**
- Header: meeting date, org name, booking type (no client-specific info — keep it professional)
- Summary section (same MeetingSummaryView component reused)
- Action items with client-facing checkboxes (state stored in localStorage — client-side only, no DB persistence for MVP)
- Footer: "Powered by [org name]" — branding for the host's business

**No transcript shown** — host shares summary only, not the raw transcript.

### 5. Middleware exclusion
Add `/share/recording/` to the middleware matcher exclusion list (public page, no auth needed).

### 6. Copy link helper in dashboard
On the recording detail page, when sharing is enabled, show:
- The shareable URL in a read-only input with copy button
- "Link copied!" toast on copy

### TypeScript + Build
Run `npx tsc --noEmit` and `npm run build`. Commit in two groups: schema/router, then UI.
