# PRD: Email Settings UI (Per Booking Type)

**Status:** Approved — build it

## Goal
Let the host configure review request and follow-up emails per booking type. Currently these are stored in `emailSettings` JSONB on bookingTypes but there's no UI to change them.

## User Stories
- As a **host**, I can enable/disable review request emails per booking type and set the delay
- As a **host**, I can write a custom subject and body for review request emails (with placeholder hints)
- As a **host**, I can enable/disable follow-up emails and set the delay in days
- As a **host**, I can preview the placeholder variables available ({{clientName}}, {{bookingType}}, etc.)

## Implementation Plan

### 1. Booking type update tRPC mutation
In `src/server/routers/booking-types.ts` (check if exists, create if not), add:
```ts
updateEmailSettings: orgProcedure
  .input(z.object({
    id: z.string().uuid(),
    emailSettings: z.object({
      reviewRequest: z.object({
        enabled: z.boolean(),
        delayMinutes: z.number().min(0).max(10080), // max 7 days in minutes
        subject: z.string().max(200),
        body: z.string().max(2000),
      }),
      followUpReminder: z.object({
        enabled: z.boolean(),
        delayDays: z.number().min(1).max(365),
        subject: z.string().max(200),
        body: z.string().max(2000),
      }),
    }),
  }))
  .mutation(async ({ ctx, input }) => {
    // verify booking type belongs to org
    // update emailSettings column
    return { success: true }
  })
```

Also add `getById: orgProcedure` to fetch a single booking type for the edit page.

### 2. Booking type edit page — email section
In `src/app/(dashboard)/dashboard/booking-types/[id]/edit/page.tsx`:
Check if this file exists. If not, create it. If it exists, add an "Email Notifications" section at the bottom.

The email settings section should have two collapsible panels:

**Review Request panel:**
- Toggle: Enable review request (Switch)
- Delay: "Send X minutes after meeting ends" (Number input, shown only when enabled)
- Subject: text input
- Body: textarea with line count
- Placeholder hint: grey text below body showing available vars

**Follow-Up Reminder panel:**
- Toggle: Enable follow-up reminder (Switch)
- Delay: "Send X days after meeting ends" (Number input, min 1)
- Subject: text input
- Body: textarea

**Placeholder reference:**
```
Available placeholders: {{clientName}}, {{bookingType}}, {{bookingDate}}, {{hostName}}
```

**Save button:** calls updateEmailSettings mutation, shows toast on success

### 3. Booking types list — edit links
In `src/app/(dashboard)/dashboard/booking-types/page.tsx`, ensure each booking type has an Edit button linking to `/dashboard/booking-types/[id]/edit`

### 4. Validation
- Subject: required, max 200 chars
- Body: required, max 2000 chars
- Delay minutes: 0–10080 (0 = immediately after meeting ends)
- Delay days: 1–365

### TypeScript + Build
Run `npx tsc --noEmit` and `npm run build`. Commit in two groups: router changes, then UI.
