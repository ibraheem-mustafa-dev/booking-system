# PRD: Dashboard Overview Page

**Status:** Approved — build it

## Goal
Replace the empty dashboard home page with a useful at-a-glance overview: upcoming bookings, recent activity, key stats, and quick actions.

## User Stories
- As a **host**, I open the dashboard and immediately see what's happening today and this week
- As a **host**, I see key numbers (bookings this month, revenue, outstanding invoices) without clicking around
- As a **host**, I can jump to common actions (New Booking, Upload Recording) in one click

## Implementation Plan

### 1. Dashboard stats tRPC endpoint
Add to `src/server/routers/dashboard.ts` (create if not exists, register in root router):

```ts
getOverview: orgProcedure.query(async ({ ctx }) => {
  // Run in parallel
  const [upcomingBookings, recentBookings, statsRow, outstandingInvoices] = await Promise.all([
    // Next 7 days bookings
    db.select({ id, clientName, startAt, endAt, status })
      .from(bookings).where(and(eq(orgId, ctx.orgId), gte(startAt, now), lte(startAt, +7days)))
      .orderBy(asc(startAt)).limit(10),
    // Last 5 bookings  
    db.select({ id, clientName, startAt, status })
      .from(bookings).where(eq(orgId, ctx.orgId))
      .orderBy(desc(startAt)).limit(5),
    // This month stats: count bookings, sum paid invoices
    db.select({ bookingCount: count(), totalRevenue: sum(amount) })
      .from(bookings).leftJoin(invoices...).where(...this month, orgId),
    // Outstanding invoices count + total
    db.select({ count: count(), total: sum(amount) })
      .from(invoices).where(eq(orgId, ctx.orgId), eq(status, 'sent'))
  ]);
  return { upcomingBookings, recentBookings, statsRow, outstandingInvoices };
})
```

### 2. Dashboard home page — `src/app/(dashboard)/dashboard/page.tsx`
Replace the current placeholder with:

**Top row — 4 stat cards:**
- Bookings this month (count)
- Revenue this month (sum of paid invoice amounts, formatted as £)
- Outstanding invoices (count + total, links to /invoices filtered by unpaid)
- Recordings this month (count)

**Middle section — "Upcoming This Week" table:**
- Client name, date/time, status badge
- Row click → /dashboard/bookings/[id]
- Empty state: "No bookings this week — great time to plan ahead"

**Right sidebar (or bottom section on mobile) — Quick Actions:**
- New Booking → /dashboard/bookings/new
- Upload Recording → /dashboard/recordings
- Create Invoice → /dashboard/invoices/new

**Bottom — Recent Activity (last 5 bookings):**
- Simple list, newest first, with relative time ("2 hours ago", "yesterday")

### 3. Register dashboard router in root router
In `src/server/routers/index.ts` (or wherever routers are assembled), add:
```ts
dashboard: dashboardRouter
```

### 4. Design notes
- Use shadcn Card for stat boxes, clean numbers, muted labels
- UK English: "this week", "this month", £ currency
- Mobile responsive — stat cards stack to 2×2 on mobile
- No charts for v1 — just numbers and lists

### TypeScript + Build
Run `npx tsc --noEmit` and `npm run build`. Commit as one logical unit.
