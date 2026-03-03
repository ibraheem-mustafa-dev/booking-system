# PRD: Booking Type Full Management (Edit + Delete + Duplicate)

**Status:** Approved — build it

## Goal
Booking types can currently be created but not edited or deleted. Complete the CRUD so the host can manage their service offerings properly.

## User Stories
- As a **host**, I can edit a booking type's name, duration, price, description, and colour
- As a **host**, I can delete a booking type (with a warning if it has active/future bookings)
- As a **host**, I can duplicate a booking type to quickly create a similar one
- As a **host**, I can set a booking type to inactive so it doesn't appear on the public booking page

## Implementation Plan

### 1. Booking types tRPC router
Create/update `src/server/routers/booking-types.ts` with:

```ts
getById: orgProcedure.input(z.object({ id: z.string().uuid() })).query(...)
update: orgProcedure.input(z.object({ id, name, description, durationMins, price, colour, isActive, ... })).mutation(...)
delete: orgProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
  // Check for future bookings — if any exist, return error with count
  // If safe, delete the booking type (cascade should handle related data)
})
duplicate: orgProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
  // Load source booking type
  // Insert copy with name: "Copy of [original name]", new ID
  // Return new booking type
})
```

### 2. Schema — isActive column
Check if `bookingTypes` has `isActive` or `active` boolean column. If not, add:
```ts
isActive: boolean('is_active').default(true).notNull(),
```
Run `npx drizzle-kit generate`.

### 3. Edit page — `src/app/(dashboard)/dashboard/booking-types/[id]/edit/page.tsx`
Full form with all booking type fields:
- Name (text, required)
- Description (textarea, optional)
- Duration in minutes (number, required)
- Price (number, optional — 0 = free)
- Colour (colour picker or colour input, used for booking page UI)
- Active toggle (Switch — inactive types hidden from public booking page)
- Location/video link default (optional)

Save → calls update mutation → toast → back to booking types list

Also include the email settings section from `prd-email-settings-ui.md` (combined into one page).

### 4. Booking types list page updates
In `src/app/(dashboard)/dashboard/booking-types/page.tsx`:
- Each row gets: **Edit** → `/booking-types/[id]/edit`, **Duplicate** button (inline mutation), **Delete** button (confirmation dialog)
- Show active/inactive badge
- Inactive types shown with muted styling

### 5. Delete confirmation dialog
Use shadcn AlertDialog:
- "Are you sure you want to delete [name]?"
- If there are future bookings: "This booking type has X upcoming bookings. Those bookings will not be affected but clients won't be able to book new sessions."
- "Delete" (destructive) + "Cancel" buttons

### 6. Public booking page — filter inactive types
In `src/app/book/[orgSlug]/page.tsx` (the booking landing page), filter out booking types where `isActive = false`.

### TypeScript + Build
Run `npx tsc --noEmit` and `npm run build`. Commit: router changes first, then UI.
