# Email System + .ics Calendar Generation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the email notification system (6 types: confirmation, host notification, 24h reminder, 1h reminder, review request, follow-up) and .ics calendar file generation so bookings send real emails with "Add to Calendar" links.

**Architecture:** Immediate sends for confirmation + notification in the booking create API route via Resend. Scheduled sends for reminders, review requests, and follow-ups via BullMQ delayed jobs processed by a standalone worker. All emails use React Email templates wrapped in a branded layout that pulls org branding from the DB. .ics files generated inline and attached to confirmation emails.

**Tech Stack:** Resend (send API), @react-email/components (templates), BullMQ + ioredis (job queue), date-fns (date formatting), ical-generator (.ics files)

---

## Task 1: Redis Connection + Queue Setup

**Files:**
- Create: `src/lib/queue/connection.ts`
- Create: `src/lib/queue/email.ts`
- Test: `src/lib/queue/email.test.ts`

**Step 1: Create shared Redis connection**

```ts
// src/lib/queue/connection.ts
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Shared connection for BullMQ — reuse across queue + worker
// Lazy singleton: only connects when first imported
let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
    });
  }
  return connection;
}
```

**Step 2: Create email queue with scheduling helpers**

```ts
// src/lib/queue/email.ts
import { Queue } from 'bullmq';
import { getRedisConnection } from './connection';

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

export type EmailJobData =
  | { type: 'confirmation'; bookingId: string }
  | { type: 'notification'; bookingId: string }
  | { type: '24h_reminder'; bookingId: string; reminderId: string }
  | { type: '1h_reminder'; bookingId: string; reminderId: string }
  | { type: 'review_request'; bookingId: string; reminderId: string }
  | { type: 'follow_up'; bookingId: string; reminderId: string };

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

let emailQueue: Queue<EmailJobData> | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>('email', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return emailQueue;
}

// ---------------------------------------------------------------------------
// Scheduling helpers
// ---------------------------------------------------------------------------

/**
 * Schedule a delayed email job. Returns the BullMQ job ID.
 * If the delay is negative (i.e. the send time has already passed), returns null.
 */
export async function scheduleEmailJob(
  data: EmailJobData,
  sendAt: Date,
): Promise<string | null> {
  const delay = sendAt.getTime() - Date.now();
  if (delay < 0) return null;

  const queue = getEmailQueue();
  const job = await queue.add(data.type, data, { delay });
  return job.id ?? null;
}

/**
 * Remove a scheduled job by its BullMQ job ID (e.g. when a booking is cancelled).
 */
export async function removeEmailJob(jobId: string): Promise<void> {
  const queue = getEmailQueue();
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
  }
}
```

**Step 3: Write tests for scheduling logic**

```ts
// src/lib/queue/email.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the pure logic: delay calculation, null for past dates.
// We mock BullMQ to avoid needing a real Redis connection.

vi.mock('bullmq', () => {
  const addMock = vi.fn().mockResolvedValue({ id: 'mock-job-id' });
  const getJobMock = vi.fn().mockResolvedValue({ remove: vi.fn() });
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: addMock,
      getJob: getJobMock,
    })),
  };
});

vi.mock('./connection', () => ({
  getRedisConnection: vi.fn().mockReturnValue({}),
}));

import { scheduleEmailJob, getEmailQueue } from './email';

describe('scheduleEmailJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for a date in the past', async () => {
    const pastDate = new Date(Date.now() - 60_000);
    const result = await scheduleEmailJob(
      { type: '24h_reminder', bookingId: 'b1', reminderId: 'r1' },
      pastDate,
    );
    expect(result).toBeNull();
  });

  it('schedules a job with correct delay for a future date', async () => {
    const futureDate = new Date(Date.now() + 3_600_000); // 1 hour from now
    const result = await scheduleEmailJob(
      { type: '1h_reminder', bookingId: 'b1', reminderId: 'r1' },
      futureDate,
    );
    expect(result).toBe('mock-job-id');

    const queue = getEmailQueue();
    expect(queue.add).toHaveBeenCalledWith(
      '1h_reminder',
      { type: '1h_reminder', bookingId: 'b1', reminderId: 'r1' },
      expect.objectContaining({ delay: expect.any(Number) }),
    );

    // Delay should be approximately 1 hour (within 5s tolerance)
    const callArgs = (queue.add as ReturnType<typeof vi.fn>).mock.calls[0];
    const delay = callArgs[2].delay;
    expect(delay).toBeGreaterThan(3_595_000);
    expect(delay).toBeLessThan(3_601_000);
  });
});
```

**Step 4: Run tests**

Run: `npx vitest run src/lib/queue/email.test.ts`
Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add src/lib/queue/connection.ts src/lib/queue/email.ts src/lib/queue/email.test.ts
git commit -m "feat: add Redis connection and email queue with scheduling helpers"
```

---

## Task 2: .ics Calendar File Generation

**Files:**
- Create: `src/lib/calendar/ics.ts`
- Test: `src/lib/calendar/ics.test.ts`

**Step 1: Write failing test for .ics generation**

```ts
// src/lib/calendar/ics.test.ts
import { describe, it, expect } from 'vitest';
import { generateIcsFile } from './ics';

describe('generateIcsFile', () => {
  const baseParams = {
    summary: '45-Minute Strategy Session',
    description: 'Booked via Small Giants Studio',
    startAt: new Date('2026-03-15T14:00:00Z'),
    endAt: new Date('2026-03-15T14:45:00Z'),
    location: 'https://meet.google.com/abc-defg-hij',
    organiserName: 'Bean',
    organiserEmail: 'bean@smallgiantsstudio.co.uk',
    attendeeName: 'Alice Smith',
    attendeeEmail: 'alice@example.com',
    uid: 'booking-123',
  };

  it('returns a valid iCalendar string', () => {
    const ics = generateIcsFile(baseParams);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
  });

  it('contains the correct event details', () => {
    const ics = generateIcsFile(baseParams);
    expect(ics).toContain('SUMMARY:45-Minute Strategy Session');
    expect(ics).toContain('DTSTART:20260315T140000Z');
    expect(ics).toContain('DTEND:20260315T144500Z');
    expect(ics).toContain('LOCATION:https://meet.google.com/abc-defg-hij');
    expect(ics).toContain('UID:booking-123');
  });

  it('includes organiser and attendee', () => {
    const ics = generateIcsFile(baseParams);
    expect(ics).toContain('ORGANIZER;CN=Bean:mailto:bean@smallgiantsstudio.co.uk');
    expect(ics).toContain('ATTENDEE;CN=Alice Smith:mailto:alice@example.com');
  });

  it('handles missing optional location', () => {
    const ics = generateIcsFile({ ...baseParams, location: undefined });
    expect(ics).not.toContain('LOCATION:');
    expect(ics).toContain('BEGIN:VEVENT');
  });

  it('escapes special characters in text fields', () => {
    const ics = generateIcsFile({
      ...baseParams,
      summary: 'Session with commas, semicolons; and newlines\nhere',
    });
    expect(ics).toContain('SUMMARY:Session with commas\\, semicolons\\; and newlines\\nhere');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/calendar/ics.test.ts`
Expected: FAIL — module not found

**Step 3: Implement .ics generator (no external dependency — RFC 5545 is simple)**

```ts
// src/lib/calendar/ics.ts

interface IcsParams {
  summary: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  location?: string;
  organiserName: string;
  organiserEmail: string;
  attendeeName: string;
  attendeeEmail: string;
  uid: string;
}

/**
 * Escape text values per RFC 5545 section 3.3.11.
 * Backslash-escapes commas, semicolons, backslashes, and newlines.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Format a Date as an iCalendar UTC datetime string: YYYYMMDDTHHMMSSZ
 */
function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generate an RFC 5545 iCalendar (.ics) file content for a booking.
 * Returns the file as a string. No external dependencies.
 */
export function generateIcsFile(params: IcsParams): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Small Giants Studio//Booking System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${params.uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(params.startAt)}`,
    `DTEND:${formatIcsDate(params.endAt)}`,
    `SUMMARY:${escapeIcsText(params.summary)}`,
  ];

  if (params.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(params.description)}`);
  }

  if (params.location) {
    lines.push(`LOCATION:${escapeIcsText(params.location)}`);
  }

  lines.push(
    `ORGANIZER;CN=${escapeIcsText(params.organiserName)}:mailto:${params.organiserEmail}`,
    `ATTENDEE;CN=${escapeIcsText(params.attendeeName)}:mailto:${params.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  );

  return lines.join('\r\n');
}
```

**Step 4: Run tests**

Run: `npx vitest run src/lib/calendar/ics.test.ts`
Expected: 5 tests PASS

**Step 5: Commit**

```bash
git add src/lib/calendar/ics.ts src/lib/calendar/ics.test.ts
git commit -m "feat: add .ics calendar file generator with RFC 5545 compliance"
```

---

## Task 3: Resend Client + Email Sending Helper

**Files:**
- Create: `src/lib/email/resend.ts`

**Step 1: Create Resend wrapper**

```ts
// src/lib/email/resend.ts
import { Resend } from 'resend';
import type { ReactElement } from 'react';

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM || 'Small Giants Studio <bookings@smallgiantsstudio.co.uk>';

interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement;
  replyTo?: string;
  attachments?: { filename: string; content: string }[];
}

/**
 * Send an email via Resend. Returns the Resend email ID on success, null on failure.
 * Logs errors to console but does not throw — email failures should not crash the app.
 */
export async function sendEmail(options: SendEmailOptions): Promise<string | null> {
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      react: options.react,
      replyTo: options.replyTo,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'utf-8'),
      })),
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    console.error('[email] Failed to send:', err);
    return null;
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/email/resend.ts
git commit -m "feat: add Resend email client wrapper"
```

---

## Task 4: Branded Email Layout Template

**Files:**
- Create: `src/lib/email/templates/layout.tsx`

**Step 1: Create branded layout wrapper**

This wraps every email with the org's branding (logo, primary colour, name, footer).
Uses React Email components: Html, Head, Body, Container, Section, Img, Text, Hr, Font, Preview.

```tsx
// src/lib/email/templates/layout.tsx
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Img,
  Font,
  Preview,
} from '@react-email/components';
import type { ReactNode } from 'react';

interface LayoutProps {
  previewText: string;
  orgName: string;
  orgLogoUrl?: string;
  primaryColour: string;
  children: ReactNode;
  footerText?: string; // e.g. "Small Giants Studio Ltd · 123 High Street · London"
}

export function EmailLayout({
  previewText,
  orgName,
  orgLogoUrl,
  primaryColour,
  children,
  footerText,
}: LayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={{
        backgroundColor: '#f4f4f5',
        fontFamily: 'Inter, Helvetica, Arial, sans-serif',
        margin: 0,
        padding: 0,
      }}>
        <Container style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '40px 20px',
        }}>
          {/* Header with logo or org name */}
          <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
            {orgLogoUrl ? (
              <Img
                src={orgLogoUrl}
                alt={orgName}
                height="48"
                style={{ margin: '0 auto' }}
              />
            ) : (
              <Text style={{
                fontSize: '20px',
                fontWeight: 700,
                color: primaryColour,
                margin: 0,
              }}>
                {orgName}
              </Text>
            )}
          </Section>

          {/* Main content card */}
          <Section style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '32px',
            border: '1px solid #e4e4e7',
          }}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={{ textAlign: 'center' as const, marginTop: '32px' }}>
            <Hr style={{ borderColor: '#e4e4e7', margin: '0 0 16px' }} />
            {footerText && (
              <Text style={{ fontSize: '12px', color: '#71717a', margin: '0 0 8px' }}>
                {footerText}
              </Text>
            )}
            <Text style={{ fontSize: '11px', color: '#a1a1aa', margin: 0 }}>
              Powered by {orgName}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

**Step 2: Commit**

```bash
git add src/lib/email/templates/layout.tsx
git commit -m "feat: add branded email layout template"
```

---

## Task 5: Confirmation Email Template

**Files:**
- Create: `src/lib/email/templates/confirmation.tsx`

**Step 1: Create confirmation email template**

This is the most important email — sent to the client immediately after booking.
Must include: booking details at a glance, Add to Calendar button, Reschedule/Cancel links (placeholder URLs until Phase 2 endpoints exist), location/video link.

```tsx
// src/lib/email/templates/confirmation.tsx
import {
  Section,
  Text,
  Button,
  Hr,
  Row,
  Column,
} from '@react-email/components';
import { EmailLayout } from './layout';

interface ConfirmationEmailProps {
  // Booking details
  clientName: string;
  bookingTypeName: string;
  dateFormatted: string;    // e.g. "Wednesday 15 March 2026"
  timeFormatted: string;    // e.g. "2:00 PM - 2:45 PM"
  timezone: string;         // e.g. "Europe/London"
  durationMins: number;
  location?: string;        // address for in-person
  videoLink?: string;       // video meeting URL
  hostName: string;
  // Action URLs
  addToCalendarUrl: string; // Google Calendar URL (web)
  icsDownloadUrl: string;   // Direct .ics file download
  rescheduleUrl?: string;   // Token-based reschedule link (Phase 2)
  cancelUrl?: string;       // Token-based cancel link (Phase 2)
  // Branding
  orgName: string;
  orgLogoUrl?: string;
  primaryColour: string;
  footerText?: string;
}

export function ConfirmationEmail(props: ConfirmationEmailProps) {
  return (
    <EmailLayout
      previewText={`Booking confirmed: ${props.bookingTypeName} on ${props.dateFormatted}`}
      orgName={props.orgName}
      orgLogoUrl={props.orgLogoUrl}
      primaryColour={props.primaryColour}
      footerText={props.footerText}
    >
      <Text style={{ fontSize: '22px', fontWeight: 700, color: '#18181b', margin: '0 0 8px' }}>
        Booking Confirmed
      </Text>
      <Text style={{ fontSize: '15px', color: '#52525b', margin: '0 0 24px' }}>
        Hi {props.clientName}, your booking is confirmed.
      </Text>

      {/* Booking details card */}
      <Section style={{
        backgroundColor: '#fafafa',
        borderRadius: '6px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid #e4e4e7',
      }}>
        <Text style={{ fontSize: '16px', fontWeight: 600, color: '#18181b', margin: '0 0 12px' }}>
          {props.bookingTypeName}
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
          {props.dateFormatted}
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
          {props.timeFormatted} ({props.timezone})
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
          {props.durationMins} minutes
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
          Host: {props.hostName}
        </Text>
        {props.videoLink && (
          <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '8px 0 0' }}>
            Video: {props.videoLink}
          </Text>
        )}
        {props.location && (
          <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '8px 0 0' }}>
            Location: {props.location}
          </Text>
        )}
      </Section>

      {/* Add to Calendar buttons */}
      <Section style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
        <Row>
          <Column style={{ width: '50%', paddingRight: '6px' }}>
            <Button
              href={props.addToCalendarUrl}
              style={{
                backgroundColor: props.primaryColour,
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'block',
                textAlign: 'center' as const,
              }}
            >
              Add to Google Calendar
            </Button>
          </Column>
          <Column style={{ width: '50%', paddingLeft: '6px' }}>
            <Button
              href={props.icsDownloadUrl}
              style={{
                backgroundColor: '#ffffff',
                color: props.primaryColour,
                padding: '12px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                border: `2px solid ${props.primaryColour}`,
                display: 'block',
                textAlign: 'center' as const,
              }}
            >
              Download .ics File
            </Button>
          </Column>
        </Row>
      </Section>

      {/* Reschedule / Cancel links */}
      {(props.rescheduleUrl || props.cancelUrl) && (
        <>
          <Hr style={{ borderColor: '#e4e4e7', margin: '0 0 16px' }} />
          <Text style={{ fontSize: '13px', color: '#71717a', textAlign: 'center' as const, margin: '0' }}>
            Need to make changes?{' '}
            {props.rescheduleUrl && (
              <a href={props.rescheduleUrl} style={{ color: props.primaryColour }}>Reschedule</a>
            )}
            {props.rescheduleUrl && props.cancelUrl && ' · '}
            {props.cancelUrl && (
              <a href={props.cancelUrl} style={{ color: '#dc2626' }}>Cancel</a>
            )}
          </Text>
        </>
      )}
    </EmailLayout>
  );
}
```

**Step 2: Commit**

```bash
git add src/lib/email/templates/confirmation.tsx
git commit -m "feat: add booking confirmation email template"
```

---

## Task 6: Host Notification Email Template

**Files:**
- Create: `src/lib/email/templates/notification.tsx`

**Step 1: Create host notification template**

Sent to the organiser/host when someone books. Shows who booked, what, and when.

```tsx
// src/lib/email/templates/notification.tsx
import {
  Section,
  Text,
  Button,
} from '@react-email/components';
import { EmailLayout } from './layout';

interface NotificationEmailProps {
  hostName: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  bookingTypeName: string;
  dateFormatted: string;
  timeFormatted: string;
  timezone: string;
  durationMins: number;
  location?: string;
  videoLink?: string;
  notes?: string;
  customFields?: { label: string; value: string }[];
  dashboardUrl: string;
  orgName: string;
  orgLogoUrl?: string;
  primaryColour: string;
  footerText?: string;
}

export function NotificationEmail(props: NotificationEmailProps) {
  return (
    <EmailLayout
      previewText={`New booking: ${props.clientName} booked ${props.bookingTypeName}`}
      orgName={props.orgName}
      orgLogoUrl={props.orgLogoUrl}
      primaryColour={props.primaryColour}
      footerText={props.footerText}
    >
      <Text style={{ fontSize: '22px', fontWeight: 700, color: '#18181b', margin: '0 0 8px' }}>
        New Booking
      </Text>
      <Text style={{ fontSize: '15px', color: '#52525b', margin: '0 0 24px' }}>
        Hi {props.hostName}, you have a new booking.
      </Text>

      {/* Booking details */}
      <Section style={{
        backgroundColor: '#fafafa',
        borderRadius: '6px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid #e4e4e7',
      }}>
        <Text style={{ fontSize: '16px', fontWeight: 600, color: '#18181b', margin: '0 0 12px' }}>
          {props.bookingTypeName}
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
          {props.dateFormatted} at {props.timeFormatted} ({props.timezone})
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
          {props.durationMins} minutes
        </Text>
        {props.videoLink && (
          <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '4px 0 0' }}>
            Video: {props.videoLink}
          </Text>
        )}
        {props.location && (
          <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '4px 0 0' }}>
            Location: {props.location}
          </Text>
        )}
      </Section>

      {/* Client info */}
      <Section style={{
        backgroundColor: '#fafafa',
        borderRadius: '6px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid #e4e4e7',
      }}>
        <Text style={{ fontSize: '14px', fontWeight: 600, color: '#18181b', margin: '0 0 8px' }}>
          Client Details
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
          {props.clientName}
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
          {props.clientEmail}
        </Text>
        {props.clientPhone && (
          <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
            {props.clientPhone}
          </Text>
        )}
        {props.notes && (
          <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '8px 0 0', fontStyle: 'italic' }}>
            Notes: {props.notes}
          </Text>
        )}
        {props.customFields && props.customFields.length > 0 && (
          <>
            {props.customFields.map((field, i) => (
              <Text key={i} style={{ fontSize: '14px', color: '#3f3f46', margin: '4px 0 0' }}>
                {field.label}: {field.value}
              </Text>
            ))}
          </>
        )}
      </Section>

      {/* Dashboard link */}
      <Section style={{ textAlign: 'center' as const }}>
        <Button
          href={props.dashboardUrl}
          style={{
            backgroundColor: props.primaryColour,
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          View in Dashboard
        </Button>
      </Section>
    </EmailLayout>
  );
}
```

**Step 2: Commit**

```bash
git add src/lib/email/templates/notification.tsx
git commit -m "feat: add host notification email template"
```

---

## Task 7: Reminder Email Template

**Files:**
- Create: `src/lib/email/templates/reminder.tsx`

**Step 1: Create parameterised reminder template (shared for 24h and 1h)**

```tsx
// src/lib/email/templates/reminder.tsx
import {
  Section,
  Text,
  Button,
  Hr,
  Row,
  Column,
} from '@react-email/components';
import { EmailLayout } from './layout';

interface ReminderEmailProps {
  reminderType: '24h' | '1h';
  clientName: string;
  bookingTypeName: string;
  dateFormatted: string;
  timeFormatted: string;
  timezone: string;
  durationMins: number;
  location?: string;
  videoLink?: string;
  hostName: string;
  addToCalendarUrl: string;
  icsDownloadUrl: string;
  rescheduleUrl?: string;
  cancelUrl?: string;
  orgName: string;
  orgLogoUrl?: string;
  primaryColour: string;
  footerText?: string;
}

export function ReminderEmail(props: ReminderEmailProps) {
  const timeLabel = props.reminderType === '24h' ? 'tomorrow' : 'in 1 hour';

  return (
    <EmailLayout
      previewText={`Reminder: ${props.bookingTypeName} ${timeLabel}`}
      orgName={props.orgName}
      orgLogoUrl={props.orgLogoUrl}
      primaryColour={props.primaryColour}
      footerText={props.footerText}
    >
      <Text style={{ fontSize: '22px', fontWeight: 700, color: '#18181b', margin: '0 0 8px' }}>
        Reminder: Your Booking is {timeLabel}
      </Text>
      <Text style={{ fontSize: '15px', color: '#52525b', margin: '0 0 24px' }}>
        Hi {props.clientName}, just a reminder about your upcoming booking.
      </Text>

      <Section style={{
        backgroundColor: '#fafafa',
        borderRadius: '6px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid #e4e4e7',
      }}>
        <Text style={{ fontSize: '16px', fontWeight: 600, color: '#18181b', margin: '0 0 12px' }}>
          {props.bookingTypeName}
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
          {props.dateFormatted}
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
          {props.timeFormatted} ({props.timezone})
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '0 0 4px' }}>
          {props.durationMins} minutes with {props.hostName}
        </Text>
        {props.videoLink && (
          <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '8px 0 0' }}>
            Video: {props.videoLink}
          </Text>
        )}
        {props.location && (
          <Text style={{ fontSize: '14px', color: '#3f3f46', margin: '8px 0 0' }}>
            Location: {props.location}
          </Text>
        )}
      </Section>

      <Section style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
        <Row>
          <Column style={{ width: '50%', paddingRight: '6px' }}>
            <Button
              href={props.addToCalendarUrl}
              style={{
                backgroundColor: props.primaryColour,
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'block',
                textAlign: 'center' as const,
              }}
            >
              Add to Calendar
            </Button>
          </Column>
          <Column style={{ width: '50%', paddingLeft: '6px' }}>
            <Button
              href={props.icsDownloadUrl}
              style={{
                backgroundColor: '#ffffff',
                color: props.primaryColour,
                padding: '12px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                border: `2px solid ${props.primaryColour}`,
                display: 'block',
                textAlign: 'center' as const,
              }}
            >
              Download .ics
            </Button>
          </Column>
        </Row>
      </Section>

      {(props.rescheduleUrl || props.cancelUrl) && (
        <>
          <Hr style={{ borderColor: '#e4e4e7', margin: '0 0 16px' }} />
          <Text style={{ fontSize: '13px', color: '#71717a', textAlign: 'center' as const, margin: '0' }}>
            Need to make changes?{' '}
            {props.rescheduleUrl && (
              <a href={props.rescheduleUrl} style={{ color: props.primaryColour }}>Reschedule</a>
            )}
            {props.rescheduleUrl && props.cancelUrl && ' · '}
            {props.cancelUrl && (
              <a href={props.cancelUrl} style={{ color: '#dc2626' }}>Cancel</a>
            )}
          </Text>
        </>
      )}
    </EmailLayout>
  );
}
```

**Step 2: Commit**

```bash
git add src/lib/email/templates/reminder.tsx
git commit -m "feat: add booking reminder email template (24h and 1h)"
```

---

## Task 8: Review Request + Follow-Up Email Templates

**Files:**
- Create: `src/lib/email/templates/review-request.tsx`
- Create: `src/lib/email/templates/follow-up.tsx`
- Create: `src/lib/email/helpers.ts`

**Step 1: Create placeholder replacement helper**

```ts
// src/lib/email/helpers.ts

/**
 * Replace {{placeholder}} tokens in a string with actual values.
 */
export function replacePlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (match, key) => values[key] ?? match,
  );
}
```

**Step 2: Create review request template (uses Markdown component for custom body)**

```tsx
// src/lib/email/templates/review-request.tsx
import {
  Section,
  Text,
  Markdown,
} from '@react-email/components';
import { EmailLayout } from './layout';

interface ReviewRequestEmailProps {
  clientName: string;
  bodyMarkdown: string; // The host's custom body text (after placeholder replacement)
  orgName: string;
  orgLogoUrl?: string;
  primaryColour: string;
  footerText?: string;
}

export function ReviewRequestEmail(props: ReviewRequestEmailProps) {
  return (
    <EmailLayout
      previewText={`How was your experience with ${props.orgName}?`}
      orgName={props.orgName}
      orgLogoUrl={props.orgLogoUrl}
      primaryColour={props.primaryColour}
      footerText={props.footerText}
    >
      <Section>
        <Markdown
          markdownCustomStyles={{
            h1: { fontSize: '22px', fontWeight: '700', color: '#18181b', margin: '0 0 16px' },
            h2: { fontSize: '18px', fontWeight: '600', color: '#18181b', margin: '16px 0 12px' },
            p: { fontSize: '15px', lineHeight: '24px', color: '#3f3f46', margin: '0 0 12px' },
            a: { color: props.primaryColour },
          }}
          markdownContainerStyles={{ padding: 0 }}
        >
          {props.bodyMarkdown}
        </Markdown>
      </Section>
    </EmailLayout>
  );
}
```

**Step 3: Create follow-up template (similar, with "Book Again" button)**

```tsx
// src/lib/email/templates/follow-up.tsx
import {
  Section,
  Text,
  Button,
  Markdown,
} from '@react-email/components';
import { EmailLayout } from './layout';

interface FollowUpEmailProps {
  clientName: string;
  bodyMarkdown: string;
  bookingLink: string; // URL to book again
  orgName: string;
  orgLogoUrl?: string;
  primaryColour: string;
  footerText?: string;
}

export function FollowUpEmail(props: FollowUpEmailProps) {
  return (
    <EmailLayout
      previewText={`${props.orgName}: Time to book your next session`}
      orgName={props.orgName}
      orgLogoUrl={props.orgLogoUrl}
      primaryColour={props.primaryColour}
      footerText={props.footerText}
    >
      <Section>
        <Markdown
          markdownCustomStyles={{
            h1: { fontSize: '22px', fontWeight: '700', color: '#18181b', margin: '0 0 16px' },
            h2: { fontSize: '18px', fontWeight: '600', color: '#18181b', margin: '16px 0 12px' },
            p: { fontSize: '15px', lineHeight: '24px', color: '#3f3f46', margin: '0 0 12px' },
            a: { color: props.primaryColour },
          }}
          markdownContainerStyles={{ padding: 0 }}
        >
          {props.bodyMarkdown}
        </Markdown>
      </Section>

      <Section style={{ textAlign: 'center' as const, marginTop: '24px' }}>
        <Button
          href={props.bookingLink}
          style={{
            backgroundColor: props.primaryColour,
            color: '#ffffff',
            padding: '14px 28px',
            borderRadius: '6px',
            fontSize: '15px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Book Again
        </Button>
      </Section>
    </EmailLayout>
  );
}
```

**Step 4: Test placeholder helper**

```ts
// Add to a test file or inline in src/lib/email/helpers.test.ts
import { describe, it, expect } from 'vitest';
import { replacePlaceholders } from './helpers';

describe('replacePlaceholders', () => {
  it('replaces known placeholders', () => {
    const result = replacePlaceholders(
      'Hi {{clientName}}, your {{bookingType}} is confirmed.',
      { clientName: 'Alice', bookingType: 'Strategy Session' },
    );
    expect(result).toBe('Hi Alice, your Strategy Session is confirmed.');
  });

  it('leaves unknown placeholders untouched', () => {
    const result = replacePlaceholders(
      'Hello {{unknown}}!',
      { clientName: 'Alice' },
    );
    expect(result).toBe('Hello {{unknown}}!');
  });
});
```

**Step 5: Run tests**

Run: `npx vitest run src/lib/email/helpers.test.ts`
Expected: 2 tests PASS

**Step 6: Commit**

```bash
git add src/lib/email/helpers.ts src/lib/email/helpers.test.ts src/lib/email/templates/review-request.tsx src/lib/email/templates/follow-up.tsx
git commit -m "feat: add review request and follow-up email templates with placeholder system"
```

---

## Task 9: Schema Change — Add emailSettings to bookingTypes

**Files:**
- Modify: `src/lib/db/schema.ts` (bookingTypes table, ~line 190-223)

**Step 1: Add emailSettings JSONB column to bookingTypes**

Add after the `requiresPayment` column (line 217):

```ts
  emailSettings: jsonb('email_settings').$type<{
    reviewRequest: {
      enabled: boolean;
      delayMinutes: number;
      subject: string;
      body: string;
    };
    followUpReminder: {
      enabled: boolean;
      delayDays: number;
      subject: string;
      body: string;
    };
  }>().default({
    reviewRequest: {
      enabled: false,
      delayMinutes: 120,
      subject: 'How was your {{bookingType}}?',
      body: 'Hi {{clientName}},\n\nWe hope you enjoyed your {{bookingType}} on {{bookingDate}}.\n\nWe would love to hear your feedback!',
    },
    followUpReminder: {
      enabled: false,
      delayDays: 30,
      subject: 'Time to book your next {{bookingType}}',
      body: 'Hi {{clientName}},\n\nIt has been a while since your last {{bookingType}}. Ready to book another session?',
    },
  }).notNull(),
```

**Step 2: Update the reminder_type enum to include new types**

Change line 55-59 from:
```ts
export const reminderTypeEnum = pgEnum('reminder_type', [
  '24h',
  '1h',
  'custom',
]);
```

To:
```ts
export const reminderTypeEnum = pgEnum('reminder_type', [
  '24h',
  '1h',
  'review_request',
  'follow_up',
  'custom',
]);
```

**Step 3: Generate and run migration**

Run: `npx drizzle-kit generate`
Then: `npx drizzle-kit migrate`

Note: The enum change may need a manual SQL migration. Drizzle doesn't always handle enum value additions. If migration fails, run manually:
```sql
ALTER TYPE reminder_type ADD VALUE IF NOT EXISTS 'review_request';
ALTER TYPE reminder_type ADD VALUE IF NOT EXISTS 'follow_up';
```

**Step 4: Commit**

```bash
git add src/lib/db/schema.ts supabase/migrations/
git commit -m "feat: add emailSettings to bookingTypes and extend reminder_type enum"
```

---

## Task 10: Email Orchestration — Wire into Booking Create Endpoint

**Files:**
- Create: `src/lib/email/send-booking-emails.ts`
- Modify: `src/app/api/v1/book/[orgSlug]/[typeSlug]/create/route.ts`

**Step 1: Create orchestration function**

This is the core function that sends immediate emails and schedules reminders.
It loads all the data it needs from the booking ID.

```ts
// src/lib/email/send-booking-emails.ts
import { db } from '@/lib/db';
import {
  bookings,
  bookingTypes,
  organisations,
  users,
  bookingReminders,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { sendEmail } from './resend';
import { generateIcsFile } from '@/lib/calendar/ics';
import { scheduleEmailJob } from '@/lib/queue/email';
import { replacePlaceholders } from './helpers';
import { ConfirmationEmail } from './templates/confirmation';
import { NotificationEmail } from './templates/notification';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface BookingEmailContext {
  bookingId: string;
  orgSlug: string;
  typeSlug: string;
}

/**
 * Sends immediate emails (confirmation + host notification) and schedules
 * reminders (24h, 1h, review request, follow-up) for a new booking.
 *
 * Call this after inserting the booking row. Failures are logged but do not
 * throw — a failed email should never prevent the booking from being confirmed.
 */
export async function sendBookingEmails(ctx: BookingEmailContext): Promise<void> {
  try {
    // Load booking with all related data in one query
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, ctx.bookingId))
      .limit(1);

    if (!booking) return;

    const [bookingType] = await db
      .select()
      .from(bookingTypes)
      .where(eq(bookingTypes.id, booking.bookingTypeId))
      .limit(1);

    const [org] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, booking.orgId))
      .limit(1);

    const [host] = await db
      .select()
      .from(users)
      .where(eq(users.id, booking.organiserId))
      .limit(1);

    if (!bookingType || !org || !host) return;

    // Format dates in client's timezone
    const clientTz = booking.clientTimezone;
    const zonedStart = toZonedTime(booking.startAt, clientTz);
    const dateFormatted = format(zonedStart, 'EEEE d MMMM yyyy');
    const startFormatted = format(zonedStart, 'h:mm a');
    const zonedEnd = toZonedTime(booking.endAt, clientTz);
    const endFormatted = format(zonedEnd, 'h:mm a');
    const timeFormatted = `${startFormatted} - ${endFormatted}`;

    const branding = org.branding;
    const footerText = [branding.companyName, branding.companyAddress]
      .filter(Boolean)
      .join(' · ') || undefined;

    // Generate .ics file
    const icsContent = generateIcsFile({
      summary: bookingType.name,
      description: `Booked via ${org.name}`,
      startAt: booking.startAt,
      endAt: booking.endAt,
      location: booking.videoLink || booking.location || undefined,
      organiserName: host.name || host.email,
      organiserEmail: host.email,
      attendeeName: booking.clientName,
      attendeeEmail: booking.clientEmail,
      uid: booking.id,
    });

    // Google Calendar "Add to Calendar" URL
    const gcalStart = booking.startAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const gcalEnd = booking.endAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const addToCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(bookingType.name)}&dates=${gcalStart}/${gcalEnd}&details=${encodeURIComponent(`Booked via ${org.name}`)}&location=${encodeURIComponent(booking.videoLink || booking.location || '')}`;

    // .ics download URL (served from a simple API route)
    const icsDownloadUrl = `${APP_URL}/api/v1/book/${ctx.orgSlug}/${ctx.typeSlug}/ics/${booking.id}`;

    // Reschedule/cancel URLs (Phase 2 — include in template, endpoints built later)
    const rescheduleUrl = booking.rescheduleToken
      ? `${APP_URL}/book/${ctx.orgSlug}/${ctx.typeSlug}/reschedule?token=${booking.rescheduleToken}`
      : undefined;
    const cancelUrl = booking.cancellationToken
      ? `${APP_URL}/book/${ctx.orgSlug}/${ctx.typeSlug}/cancel?token=${booking.cancellationToken}`
      : undefined;

    // --- Send confirmation email to client ---
    await sendEmail({
      to: booking.clientEmail,
      subject: `Booking confirmed: ${bookingType.name} on ${dateFormatted}`,
      react: ConfirmationEmail({
        clientName: booking.clientName,
        bookingTypeName: bookingType.name,
        dateFormatted,
        timeFormatted,
        timezone: clientTz,
        durationMins: bookingType.durationMins,
        location: booking.location || undefined,
        videoLink: booking.videoLink || undefined,
        hostName: host.name || host.email,
        addToCalendarUrl,
        icsDownloadUrl,
        rescheduleUrl,
        cancelUrl,
        orgName: org.name,
        orgLogoUrl: branding.logoUrl,
        primaryColour: branding.primaryColour,
        footerText,
      }),
      replyTo: host.email,
      attachments: [{ filename: 'booking.ics', content: icsContent }],
    });

    // --- Send notification email to host ---
    const customFields = bookingType.customFields?.fields
      ?.map((field) => {
        const value = booking.customFieldResponses?.[field.id];
        if (!value) return null;
        return {
          label: field.label,
          value: Array.isArray(value) ? value.join(', ') : String(value),
        };
      })
      .filter((f): f is { label: string; value: string } => f !== null);

    await sendEmail({
      to: host.email,
      subject: `New booking: ${booking.clientName} - ${bookingType.name}`,
      react: NotificationEmail({
        hostName: host.name || 'there',
        clientName: booking.clientName,
        clientEmail: booking.clientEmail,
        clientPhone: booking.clientPhone || undefined,
        bookingTypeName: bookingType.name,
        dateFormatted,
        timeFormatted,
        timezone: clientTz,
        durationMins: bookingType.durationMins,
        location: booking.location || undefined,
        videoLink: booking.videoLink || undefined,
        notes: booking.notes || undefined,
        customFields,
        dashboardUrl: `${APP_URL}/dashboard/bookings`,
        orgName: org.name,
        orgLogoUrl: branding.logoUrl,
        primaryColour: branding.primaryColour,
        footerText,
      }),
    });

    // --- Schedule reminders ---
    const startMs = booking.startAt.getTime();
    const endMs = booking.endAt.getTime();
    const now = Date.now();

    // 24h reminder
    const reminder24hAt = new Date(startMs - 24 * 60 * 60 * 1000);
    if (reminder24hAt.getTime() > now) {
      const jobId = await scheduleEmailJob(
        { type: '24h_reminder', bookingId: booking.id, reminderId: '' },
        reminder24hAt,
      );
      if (jobId) {
        const [reminder] = await db.insert(bookingReminders).values({
          bookingId: booking.id,
          type: '24h',
          scheduledAt: reminder24hAt,
          jobId,
        }).returning({ id: bookingReminders.id });
        // Update the job data with the reminder ID
        const queue = (await import('@/lib/queue/email')).getEmailQueue();
        const job = await queue.getJob(jobId);
        if (job) {
          await job.updateData({ type: '24h_reminder', bookingId: booking.id, reminderId: reminder.id });
        }
      }
    }

    // 1h reminder
    const reminder1hAt = new Date(startMs - 60 * 60 * 1000);
    if (reminder1hAt.getTime() > now) {
      const jobId = await scheduleEmailJob(
        { type: '1h_reminder', bookingId: booking.id, reminderId: '' },
        reminder1hAt,
      );
      if (jobId) {
        const [reminder] = await db.insert(bookingReminders).values({
          bookingId: booking.id,
          type: '1h',
          scheduledAt: reminder1hAt,
          jobId,
        }).returning({ id: bookingReminders.id });
        const queue = (await import('@/lib/queue/email')).getEmailQueue();
        const job = await queue.getJob(jobId);
        if (job) {
          await job.updateData({ type: '1h_reminder', bookingId: booking.id, reminderId: reminder.id });
        }
      }
    }

    // Review request (if enabled on booking type)
    const emailSettings = bookingType.emailSettings as {
      reviewRequest: { enabled: boolean; delayMinutes: number; subject: string; body: string };
      followUpReminder: { enabled: boolean; delayDays: number; subject: string; body: string };
    } | null;

    if (emailSettings?.reviewRequest?.enabled) {
      const reviewAt = new Date(endMs + emailSettings.reviewRequest.delayMinutes * 60 * 1000);
      if (reviewAt.getTime() > now) {
        const [reminder] = await db.insert(bookingReminders).values({
          bookingId: booking.id,
          type: 'review_request',
          scheduledAt: reviewAt,
        }).returning({ id: bookingReminders.id });

        const jobId = await scheduleEmailJob(
          { type: 'review_request', bookingId: booking.id, reminderId: reminder.id },
          reviewAt,
        );
        if (jobId) {
          await db.update(bookingReminders)
            .set({ jobId })
            .where(eq(bookingReminders.id, reminder.id));
        }
      }
    }

    // Follow-up reminder (if enabled on booking type)
    if (emailSettings?.followUpReminder?.enabled) {
      const followUpAt = new Date(endMs + emailSettings.followUpReminder.delayDays * 24 * 60 * 60 * 1000);
      if (followUpAt.getTime() > now) {
        const [reminder] = await db.insert(bookingReminders).values({
          bookingId: booking.id,
          type: 'follow_up',
          scheduledAt: followUpAt,
        }).returning({ id: bookingReminders.id });

        const jobId = await scheduleEmailJob(
          { type: 'follow_up', bookingId: booking.id, reminderId: reminder.id },
          followUpAt,
        );
        if (jobId) {
          await db.update(bookingReminders)
            .set({ jobId })
            .where(eq(bookingReminders.id, reminder.id));
        }
      }
    }
  } catch (err) {
    // Email failures must never crash the booking flow
    console.error('[email] Failed to send booking emails:', err);
  }
}
```

**Step 2: Add .ics download endpoint**

Create: `src/app/api/v1/book/[orgSlug]/[typeSlug]/ics/[bookingId]/route.ts`

```ts
// src/app/api/v1/book/[orgSlug]/[typeSlug]/ics/[bookingId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bookings, bookingTypes, organisations, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateIcsFile } from '@/lib/calendar/ics';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; typeSlug: string; bookingId: string }> },
) {
  const { bookingId } = await params;

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  const [bookingType] = await db
    .select()
    .from(bookingTypes)
    .where(eq(bookingTypes.id, booking.bookingTypeId))
    .limit(1);

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, booking.orgId))
    .limit(1);

  const [host] = await db
    .select()
    .from(users)
    .where(eq(users.id, booking.organiserId))
    .limit(1);

  if (!bookingType || !org || !host) {
    return NextResponse.json({ error: 'Booking data incomplete.' }, { status: 404 });
  }

  const icsContent = generateIcsFile({
    summary: bookingType.name,
    description: `Booked via ${org.name}`,
    startAt: booking.startAt,
    endAt: booking.endAt,
    location: booking.videoLink || booking.location || undefined,
    organiserName: host.name || host.email,
    organiserEmail: host.email,
    attendeeName: booking.clientName,
    attendeeEmail: booking.clientEmail,
    uid: booking.id,
  });

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="booking.ics"`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

**Step 3: Wire into the booking create endpoint**

Modify `src/app/api/v1/book/[orgSlug]/[typeSlug]/create/route.ts`.

Add import at top:
```ts
import { sendBookingEmails } from '@/lib/email/send-booking-emails';
```

Add after the `returning()` call (after line 157, before the return):
```ts
  // Send emails asynchronously — don't await to avoid slowing the booking response
  sendBookingEmails({
    bookingId: booking.id,
    orgSlug,
    typeSlug,
  }).catch((err) => {
    console.error('[booking] Email sending failed:', err);
  });
```

**Step 4: Commit**

```bash
git add src/lib/email/send-booking-emails.ts src/app/api/v1/book/[orgSlug]/[typeSlug]/ics/ src/app/api/v1/book/[orgSlug]/[typeSlug]/create/route.ts
git commit -m "feat: wire email orchestration into booking create endpoint with .ics download"
```

---

## Task 11: BullMQ Worker Process

**Files:**
- Create: `src/worker.ts`
- Modify: `package.json` (add worker script)
- Modify: `docker-compose.yml` (add worker service)

**Step 1: Create the worker**

```ts
// src/worker.ts
import 'dotenv/config';
import { Worker } from 'bullmq';
import { getRedisConnection } from './lib/queue/connection';
import { db } from './lib/db';
import { bookings, bookingTypes, organisations, users, bookingReminders } from './lib/db/schema';
import { eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { sendEmail } from './lib/email/resend';
import { replacePlaceholders } from './lib/email/helpers';
import { generateIcsFile } from './lib/calendar/ics';
import { ReminderEmail } from './lib/email/templates/reminder';
import { ReviewRequestEmail } from './lib/email/templates/review-request';
import { FollowUpEmail } from './lib/email/templates/follow-up';
import type { EmailJobData } from './lib/queue/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function loadBookingContext(bookingId: string) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking || booking.status === 'cancelled') return null;

  const [bookingType] = await db.select().from(bookingTypes).where(eq(bookingTypes.id, booking.bookingTypeId)).limit(1);
  const [org] = await db.select().from(organisations).where(eq(organisations.id, booking.orgId)).limit(1);
  const [host] = await db.select().from(users).where(eq(users.id, booking.organiserId)).limit(1);

  if (!bookingType || !org || !host) return null;

  return { booking, bookingType, org, host };
}

function formatBookingDates(booking: typeof bookings.$inferSelect) {
  const clientTz = booking.clientTimezone;
  const zonedStart = toZonedTime(booking.startAt, clientTz);
  const zonedEnd = toZonedTime(booking.endAt, clientTz);
  return {
    dateFormatted: format(zonedStart, 'EEEE d MMMM yyyy'),
    timeFormatted: `${format(zonedStart, 'h:mm a')} - ${format(zonedEnd, 'h:mm a')}`,
    clientTz,
  };
}

const worker = new Worker<EmailJobData>(
  'email',
  async (job) => {
    const { type, bookingId } = job.data;
    console.log(`[worker] Processing ${type} for booking ${bookingId}`);

    const ctx = await loadBookingContext(bookingId);
    if (!ctx) {
      console.log(`[worker] Booking ${bookingId} not found or cancelled, skipping`);
      return;
    }

    const { booking, bookingType, org, host } = ctx;
    const { dateFormatted, timeFormatted, clientTz } = formatBookingDates(booking);
    const branding = org.branding;
    const footerText = [branding.companyName, branding.companyAddress].filter(Boolean).join(' · ') || undefined;

    // .ics and calendar URLs for reminders
    const orgSlug = org.slug;
    const typeSlug = bookingType.slug;
    const gcalStart = booking.startAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const gcalEnd = booking.endAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const addToCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(bookingType.name)}&dates=${gcalStart}/${gcalEnd}&details=${encodeURIComponent(`Booked via ${org.name}`)}&location=${encodeURIComponent(booking.videoLink || booking.location || '')}`;
    const icsDownloadUrl = `${APP_URL}/api/v1/book/${orgSlug}/${typeSlug}/ics/${booking.id}`;
    const rescheduleUrl = booking.rescheduleToken ? `${APP_URL}/book/${orgSlug}/${typeSlug}/reschedule?token=${booking.rescheduleToken}` : undefined;
    const cancelUrl = booking.cancellationToken ? `${APP_URL}/book/${orgSlug}/${typeSlug}/cancel?token=${booking.cancellationToken}` : undefined;

    // Placeholder values for customisable emails
    const placeholderValues = {
      clientName: booking.clientName,
      bookingType: bookingType.name,
      bookingDate: dateFormatted,
      bookingTime: timeFormatted,
      orgName: org.name,
      bookingLink: `${APP_URL}/book/${orgSlug}/${typeSlug}`,
    };

    switch (type) {
      case '24h_reminder':
      case '1h_reminder': {
        await sendEmail({
          to: booking.clientEmail,
          subject: `Reminder: ${bookingType.name} ${type === '24h_reminder' ? 'tomorrow' : 'in 1 hour'}`,
          react: ReminderEmail({
            reminderType: type === '24h_reminder' ? '24h' : '1h',
            clientName: booking.clientName,
            bookingTypeName: bookingType.name,
            dateFormatted,
            timeFormatted,
            timezone: clientTz,
            durationMins: bookingType.durationMins,
            location: booking.location || undefined,
            videoLink: booking.videoLink || undefined,
            hostName: host.name || host.email,
            addToCalendarUrl,
            icsDownloadUrl,
            rescheduleUrl,
            cancelUrl,
            orgName: org.name,
            orgLogoUrl: branding.logoUrl,
            primaryColour: branding.primaryColour,
            footerText,
          }),
          replyTo: host.email,
        });
        break;
      }

      case 'review_request': {
        const emailSettings = bookingType.emailSettings as {
          reviewRequest: { subject: string; body: string };
        } | null;
        if (!emailSettings?.reviewRequest) return;

        const subject = replacePlaceholders(emailSettings.reviewRequest.subject, placeholderValues);
        const body = replacePlaceholders(emailSettings.reviewRequest.body, placeholderValues);

        await sendEmail({
          to: booking.clientEmail,
          subject,
          react: ReviewRequestEmail({
            clientName: booking.clientName,
            bodyMarkdown: body,
            orgName: org.name,
            orgLogoUrl: branding.logoUrl,
            primaryColour: branding.primaryColour,
            footerText,
          }),
          replyTo: host.email,
        });
        break;
      }

      case 'follow_up': {
        const emailSettings = bookingType.emailSettings as {
          followUpReminder: { subject: string; body: string };
        } | null;
        if (!emailSettings?.followUpReminder) return;

        const subject = replacePlaceholders(emailSettings.followUpReminder.subject, placeholderValues);
        const body = replacePlaceholders(emailSettings.followUpReminder.body, placeholderValues);

        await sendEmail({
          to: booking.clientEmail,
          subject,
          react: FollowUpEmail({
            clientName: booking.clientName,
            bodyMarkdown: body,
            bookingLink: `${APP_URL}/book/${orgSlug}/${typeSlug}`,
            orgName: org.name,
            orgLogoUrl: branding.logoUrl,
            primaryColour: branding.primaryColour,
            footerText,
          }),
          replyTo: host.email,
        });
        break;
      }
    }

    // Mark reminder as sent in DB
    if ('reminderId' in job.data && job.data.reminderId) {
      await db.update(bookingReminders)
        .set({ sentAt: new Date() })
        .where(eq(bookingReminders.id, job.data.reminderId));
    }

    console.log(`[worker] ${type} sent for booking ${bookingId}`);
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  },
);

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[worker] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[worker] Shutting down...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[worker] Shutting down...');
  await worker.close();
  process.exit(0);
});

console.log('[worker] Email worker started, waiting for jobs...');
```

**Step 2: Add npm script to package.json**

Add to "scripts":
```json
"worker": "npx tsx src/worker.ts"
```

**Step 3: Install tsx (TypeScript execution for the worker)**

Run: `npm install tsx --save-dev`

**Step 4: Add worker service to docker-compose.yml**

Add after the `app` service (before `volumes:`):

```yaml
  # --- Email Worker (BullMQ job processor) ---
  worker:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    command: ["node", "-e", "require('./src/worker.ts')"]
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/booking_system
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 256M
```

Note: The Dockerfile CMD is `node server.js` for the app, but the worker overrides the command. For production, we'll need a separate Dockerfile target or use tsx. This can be refined at deploy time — for now the npm script works for dev.

**Step 5: Commit**

```bash
git add src/worker.ts package.json docker-compose.yml
git commit -m "feat: add BullMQ email worker with reminder processing"
```

---

## Task 12: Install date-fns-tz and tsx Dependencies

**Note:** This should actually happen before Task 10/11 since those files import `date-fns-tz` and `tsx`. Reorder during execution if needed.

Run: `npm install date-fns-tz && npm install tsx --save-dev`

**Commit:**

```bash
git add package.json package-lock.json
git commit -m "chore: install date-fns-tz and tsx dependencies"
```

---

## Task 13: Run All Tests + TypeScript Check

**Step 1: Run vitest**

Run: `npx vitest run`
Expected: All existing tests + new queue/ics/helpers tests pass

**Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Fix any issues found**

If TypeScript errors or test failures, fix before proceeding.

---

## Task 14: Final Commit + Update CLAUDE.md

**Step 1: Mark steps 10 and 11 as done in CLAUDE.md**

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: complete email system (Step 10) and .ics generation (Step 11)"
```

---

## Execution Order Summary

1. Install dependencies (date-fns-tz, tsx) — Task 12
2. Redis connection + email queue — Task 1
3. .ics calendar generation — Task 2
4. Resend client wrapper — Task 3
5. Branded layout template — Task 4
6. Confirmation email template — Task 5
7. Host notification template — Task 6
8. Reminder template — Task 7
9. Review request + follow-up templates — Task 8
10. Schema change (emailSettings) — Task 9
11. Email orchestration + .ics endpoint — Task 10
12. BullMQ worker — Task 11
13. Tests + TypeScript check — Task 13
14. Final commit + docs update — Task 14

## Environment Variables Needed

The user will need to add these to `.env.local` (Claude cannot edit this file):

- `RESEND_API_KEY` — get from https://resend.com/api-keys
- `REDIS_URL` — `redis://localhost:6379` (needs local Redis running, or skip reminders in dev)
- `EMAIL_FROM` — already in `.env.example`

## Testing Without Redis

Immediate emails (confirmation + notification) work without Redis — they send directly via Resend. Only scheduled reminders need Redis + the worker process. For dev testing, the immediate emails can be tested first.
