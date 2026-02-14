# AI Transcription & Summary — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-booking audio transcription (Deepgram Nova-3) and AI summary (Claude Haiku 4.5) with three input methods: audio file upload, browser mic recording, and transcript text paste.

**Architecture:** REST route for file upload (tRPC can't handle multipart). tRPC for CRUD. Deepgram for speech-to-text with diarization. Claude Haiku for structured summary extraction. All processing synchronous. Audio discarded after transcription.

**Tech Stack:** `@deepgram/sdk`, `@anthropic-ai/sdk`, MediaRecorder API, Next.js API routes, tRPC, Drizzle ORM, shadcn/ui

**Design doc:** `docs/plans/2026-02-14-transcription-system-design.md`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Deepgram and Anthropic SDKs**

Run: `npm install @deepgram/sdk @anthropic-ai/sdk`

**Step 2: Verify installation**

Run: `npm ls @deepgram/sdk @anthropic-ai/sdk`
Expected: Both packages listed without errors.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @deepgram/sdk and @anthropic-ai/sdk dependencies"
```

---

## Task 2: Schema Changes

**Files:**
- Modify: `src/lib/db/schema.ts` (lines 63-66 for enum, lines 354-365 for meetingRecordings)

**Step 1: Add `transcript_paste` to recordedViaEnum**

In `src/lib/db/schema.ts`, find the `recordedViaEnum` (line 63) and add `'transcript_paste'`:

```typescript
export const recordedViaEnum = pgEnum('recorded_via', [
  'online',
  'phone_upload',
  'browser_mic',
  'transcript_paste',
]);
```

**Step 2: Add three JSONB columns + update meetingRecordings**

In `src/lib/db/schema.ts`, update the `meetingRecordings` table (line 354):

```typescript
export const meetingRecordings = pgTable('meeting_recordings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  transcriptText: text('transcript_text'),
  transcriptData: jsonb('transcript_data').$type<TranscriptUtterance[]>(),
  summaryText: text('summary_text'),
  summaryData: jsonb('summary_data').$type<StructuredSummary>(),
  summaryShared: boolean('summary_shared').default(false).notNull(),
  speakerMap: jsonb('speaker_map').$type<Record<string, string>>(),
  recordingUrl: text('recording_url'),
  recordedVia: recordedViaEnum('recorded_via').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('meeting_recordings_booking_idx').on(table.bookingId),
]);
```

**Step 3: Add TypeScript types above the table definition**

Add these types just before the `meetingRecordings` table in `src/lib/db/schema.ts`:

```typescript
// Types for meeting recordings JSONB columns
export interface TranscriptUtterance {
  speaker: number;
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface StructuredSummary {
  keyPoints: { point: string; speaker: string }[];
  decisions: { decision: string; madeBy: string }[];
  actionItems: { description: string; assignee: string; deadline: string | null }[];
  followUps: { item: string; owner: string }[];
  nextSteps: { step: string; timeline: string | null }[];
}
```

**Step 4: Generate migration**

Run: `npx drizzle-kit generate`
Expected: New migration file in `supabase/migrations/`.

**Step 5: Push to DB**

Run: `npx drizzle-kit push`
Expected: Schema changes applied to Supabase.

**Step 6: Commit**

```bash
git add src/lib/db/schema.ts supabase/migrations/
git commit -m "feat: add transcriptData, summaryData, speakerMap columns to meetingRecordings"
```

---

## Task 3: Deepgram Transcription Client

**Files:**
- Create: `src/lib/ai/deepgram.ts`
- Test: `src/lib/ai/deepgram.test.ts`

**Step 1: Write the Deepgram wrapper**

Create `src/lib/ai/deepgram.ts`:

```typescript
import { createClient } from '@deepgram/sdk';
import type { TranscriptUtterance } from '@/lib/db/schema';

// Lazy-initialised — avoids crashing when DEEPGRAM_API_KEY is missing (dev)
let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_client) {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error('DEEPGRAM_API_KEY is not set');
    _client = createClient(key);
  }
  return _client;
}

export interface TranscriptionResult {
  utterances: TranscriptUtterance[];
  plainText: string;
  speakerCount: number;
}

/**
 * Transcribe an audio buffer using Deepgram Nova-3 with speaker diarization.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<TranscriptionResult> {
  const client = getClient();

  const { result, error } = await client.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: 'nova-3',
      diarize: true,
      utterances: true,
      smart_format: true,
      punctuate: true,
      mimetype: mimeType,
    },
  );

  if (error) {
    throw new Error(`Deepgram transcription failed: ${error.message}`);
  }

  const rawUtterances = result.results?.utterances ?? [];

  if (rawUtterances.length === 0) {
    throw new Error('No speech detected in this recording.');
  }

  const utterances: TranscriptUtterance[] = rawUtterances.map((u) => ({
    speaker: u.speaker ?? 0,
    start: u.start,
    end: u.end,
    text: u.transcript,
    confidence: u.confidence,
  }));

  const plainText = utterances
    .map((u) => `[Speaker ${u.speaker}] ${u.text}`)
    .join('\n');

  const speakers = new Set(utterances.map((u) => u.speaker));

  return {
    utterances,
    plainText,
    speakerCount: speakers.size,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/deepgram.ts
git commit -m "feat: add Deepgram Nova-3 transcription client with diarization"
```

---

## Task 4: Transcript Formatter + Tests

**Files:**
- Create: `src/lib/ai/format-transcript.ts`
- Test: `src/lib/ai/format-transcript.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/ai/format-transcript.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  formatTranscriptForSummary,
  substituteSpeakerNames,
  buildDefaultSpeakerMap,
} from './format-transcript';

describe('buildDefaultSpeakerMap', () => {
  it('maps speaker 0 to organiser and speaker 1 to client', () => {
    const map = buildDefaultSpeakerMap(2, 'Sarah', 'James');
    expect(map).toEqual({ '0': 'Sarah', '1': 'James' });
  });

  it('handles single speaker', () => {
    const map = buildDefaultSpeakerMap(1, 'Sarah', 'James');
    expect(map).toEqual({ '0': 'Sarah' });
  });

  it('labels extra speakers as Speaker 3, Speaker 4, etc.', () => {
    const map = buildDefaultSpeakerMap(4, 'Sarah', 'James');
    expect(map).toEqual({
      '0': 'Sarah',
      '1': 'James',
      '2': 'Speaker 3',
      '3': 'Speaker 4',
    });
  });
});

describe('substituteSpeakerNames', () => {
  it('replaces speaker IDs with names in plain text', () => {
    const text = '[Speaker 0] Hello\n[Speaker 1] Hi there';
    const map = { '0': 'Sarah', '1': 'James' };
    const result = substituteSpeakerNames(text, map);
    expect(result).toBe('[Sarah] Hello\n[James] Hi there');
  });
});

describe('formatTranscriptForSummary', () => {
  it('formats utterances with speaker names and timestamps', () => {
    const utterances = [
      { speaker: 0, start: 0, end: 3.5, text: 'Hello, welcome.', confidence: 0.98 },
      { speaker: 1, start: 4.0, end: 7.2, text: 'Thanks for having me.', confidence: 0.95 },
    ];
    const speakerMap = { '0': 'Sarah', '1': 'James' };
    const result = formatTranscriptForSummary(utterances, speakerMap);
    expect(result).toBe(
      '[Sarah, 00:00:00] Hello, welcome.\n[James, 00:00:04] Thanks for having me.',
    );
  });

  it('formats timestamps over an hour correctly', () => {
    const utterances = [
      { speaker: 0, start: 3661.5, end: 3665, text: 'One hour in.', confidence: 0.9 },
    ];
    const speakerMap = { '0': 'Sarah' };
    const result = formatTranscriptForSummary(utterances, speakerMap);
    expect(result).toBe('[Sarah, 01:01:01] One hour in.');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/ai/format-transcript.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `src/lib/ai/format-transcript.ts`:

```typescript
import type { TranscriptUtterance } from '@/lib/db/schema';

/**
 * Build a default speaker map from booking participants.
 * Speaker 0 = organiser, Speaker 1 = client, extras = "Speaker N".
 */
export function buildDefaultSpeakerMap(
  speakerCount: number,
  organiserName: string,
  clientName: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 0; i < speakerCount; i++) {
    if (i === 0) map[String(i)] = organiserName;
    else if (i === 1) map[String(i)] = clientName;
    else map[String(i)] = `Speaker ${i + 1}`;
  }
  return map;
}

/**
 * Replace `[Speaker N]` labels in plain text with actual names.
 */
export function substituteSpeakerNames(
  text: string,
  speakerMap: Record<string, string>,
): string {
  return text.replace(/\[Speaker (\d+)\]/g, (_match, id: string) => {
    return `[${speakerMap[id] ?? `Speaker ${id}`}]`;
  });
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format utterances with speaker names and timestamps for Claude input.
 * Output: "[Sarah, 00:01:23] Welcome, thanks for coming in today..."
 */
export function formatTranscriptForSummary(
  utterances: TranscriptUtterance[],
  speakerMap: Record<string, string>,
): string {
  return utterances
    .map((u) => {
      const name = speakerMap[String(u.speaker)] ?? `Speaker ${u.speaker}`;
      return `[${name}, ${formatTimestamp(u.start)}] ${u.text}`;
    })
    .join('\n');
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/ai/format-transcript.test.ts`
Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/format-transcript.ts src/lib/ai/format-transcript.test.ts
git commit -m "feat: add transcript formatter with speaker name substitution and tests"
```

---

## Task 5: Claude Summary Client

**Files:**
- Create: `src/lib/ai/summarise.ts`

**Step 1: Write the Claude summary wrapper**

Create `src/lib/ai/summarise.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { StructuredSummary } from '@/lib/db/schema';

// Lazy-initialised — avoids crashing when ANTHROPIC_API_KEY is missing (dev)
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

const SUMMARY_PROMPT = `You are analysing a meeting transcript. Extract ONLY information explicitly stated in the transcript.
If a section has no relevant content, return an empty array for that section.
Do NOT infer, assume, or speculate. Do NOT fabricate names, dates, or details not in the transcript.

Return valid JSON matching this exact structure:
{
  "keyPoints": [{"point": "string", "speaker": "string"}],
  "decisions": [{"decision": "string", "madeBy": "string"}],
  "actionItems": [{"description": "string", "assignee": "string", "deadline": "string or null"}],
  "followUps": [{"item": "string", "owner": "string"}],
  "nextSteps": [{"step": "string", "timeline": "string or null"}]
}

Rules:
- "deadline" and "timeline" must be null if not explicitly mentioned.
- "speaker", "madeBy", "assignee", "owner" must use the exact speaker names from the transcript.
- Return ONLY the JSON object, no markdown fences, no explanation.`;

/**
 * Generate a structured meeting summary from a formatted transcript.
 */
export async function generateSummary(
  formattedTranscript: string,
  speakerNames: string[],
): Promise<{ summary: StructuredSummary; plainText: string }> {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${SUMMARY_PROMPT}\n\nParticipants: ${speakerNames.join(', ')}\n\nTranscript:\n${formattedTranscript}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  let summary: StructuredSummary;
  try {
    summary = JSON.parse(content.text) as StructuredSummary;
  } catch {
    throw new Error('Claude returned invalid JSON for summary');
  }

  // Build plain-text version for search/export
  const sections: string[] = [];

  if (summary.keyPoints.length > 0) {
    sections.push('KEY POINTS:\n' + summary.keyPoints.map((k) => `- ${k.point} (${k.speaker})`).join('\n'));
  }
  if (summary.decisions.length > 0) {
    sections.push('DECISIONS:\n' + summary.decisions.map((d) => `- ${d.decision} (${d.madeBy})`).join('\n'));
  }
  if (summary.actionItems.length > 0) {
    sections.push('ACTION ITEMS:\n' + summary.actionItems.map((a) =>
      `- ${a.description} [${a.assignee}]${a.deadline ? ` by ${a.deadline}` : ''}`
    ).join('\n'));
  }
  if (summary.followUps.length > 0) {
    sections.push('FOLLOW-UPS:\n' + summary.followUps.map((f) => `- ${f.item} (${f.owner})`).join('\n'));
  }
  if (summary.nextSteps.length > 0) {
    sections.push('NEXT STEPS:\n' + summary.nextSteps.map((n) =>
      `- ${n.step}${n.timeline ? ` (${n.timeline})` : ''}`
    ).join('\n'));
  }

  return {
    summary,
    plainText: sections.join('\n\n'),
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/ai/summarise.ts
git commit -m "feat: add Claude Haiku summary client with structured JSON extraction"
```

---

## Task 6: REST Upload Route

**Files:**
- Create: `src/app/api/v1/recordings/transcribe/route.ts`

This is the main entry point. Handles both audio file upload (multipart) and transcript text paste (JSON). Requires authenticated user.

**Step 1: Write the route**

Create `src/app/api/v1/recordings/transcribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { bookings, meetingRecordings, users, organisations, orgMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { transcribeAudio } from '@/lib/ai/deepgram';
import { generateSummary } from '@/lib/ai/summarise';
import {
  formatTranscriptForSummary,
  buildDefaultSpeakerMap,
  substituteSpeakerNames,
} from '@/lib/ai/format-transcript';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const ACCEPTED_AUDIO_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/mp4', 'audio/x-m4a', 'audio/m4a',
  'audio/webm', 'audio/ogg', 'audio/flac', 'audio/aac',
  'video/mp4', 'video/webm', // MediaRecorder may produce video/* MIME types
]);

/**
 * POST /api/v1/recordings/transcribe
 *
 * Accepts either:
 * 1. multipart/form-data with an "audio" file field + "bookingId" text field
 * 2. application/json with { bookingId, transcriptText } for transcript paste
 *
 * Requires authenticated user who owns the booking's organisation.
 */
export async function POST(request: NextRequest) {
  // -------------------------------------------------------------------------
  // 1. Authenticate
  // -------------------------------------------------------------------------
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => { try { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* read-only */ } },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // Get user's org
  const [membership] = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, user.id))
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
  }

  // -------------------------------------------------------------------------
  // 2. Parse input (multipart or JSON)
  // -------------------------------------------------------------------------
  const contentType = request.headers.get('content-type') ?? '';
  let bookingId: string;
  let audioBuffer: Buffer | null = null;
  let audioMimeType = '';
  let transcriptText: string | null = null;
  let recordedVia: 'phone_upload' | 'browser_mic' | 'transcript_paste';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    bookingId = formData.get('bookingId') as string;
    const recordedViaField = formData.get('recordedVia') as string;
    const audioFile = formData.get('audio') as File | null;

    if (!bookingId || !audioFile) {
      return NextResponse.json({ error: 'bookingId and audio file are required' }, { status: 400 });
    }

    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum is 500MB.' }, { status: 400 });
    }

    if (!ACCEPTED_AUDIO_TYPES.has(audioFile.type)) {
      return NextResponse.json({ error: 'Unsupported audio format. Try MP3, WAV, or M4A.' }, { status: 400 });
    }

    audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    audioMimeType = audioFile.type;
    recordedVia = recordedViaField === 'browser_mic' ? 'browser_mic' : 'phone_upload';
  } else {
    const body = await request.json();
    bookingId = body.bookingId;
    transcriptText = body.transcriptText;
    recordedVia = 'transcript_paste';

    if (!bookingId || !transcriptText) {
      return NextResponse.json({ error: 'bookingId and transcriptText are required' }, { status: 400 });
    }

    if (transcriptText.length > 500_000) {
      return NextResponse.json({ error: 'Transcript too long. Maximum is 500,000 characters.' }, { status: 400 });
    }
  }

  // -------------------------------------------------------------------------
  // 3. Verify booking ownership
  // -------------------------------------------------------------------------
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.orgId, membership.orgId)))
    .limit(1);

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Get organiser name for speaker map
  const [organiser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, booking.organiserId))
    .limit(1);

  const organiserName = organiser?.email?.split('@')[0] ?? 'Organiser';

  // -------------------------------------------------------------------------
  // 4. Process: transcribe (if audio) then summarise
  // -------------------------------------------------------------------------
  try {
    let utterances: import('@/lib/db/schema').TranscriptUtterance[] | null = null;
    let plainTranscript: string;
    let speakerCount: number;
    let speakerMap: Record<string, string>;

    if (audioBuffer) {
      // Audio path: Deepgram → diarised transcript
      const transcription = await transcribeAudio(audioBuffer, audioMimeType);
      utterances = transcription.utterances;
      plainTranscript = transcription.plainText;
      speakerCount = transcription.speakerCount;
      speakerMap = buildDefaultSpeakerMap(speakerCount, organiserName, booking.clientName);
    } else {
      // Transcript paste path: skip Deepgram
      plainTranscript = transcriptText!;
      speakerCount = 0;
      speakerMap = {};
    }

    // Format transcript for Claude (with speaker names if we have utterances)
    const formattedForClaude = utterances
      ? formatTranscriptForSummary(utterances, speakerMap)
      : plainTranscript;

    const speakerNames = Object.values(speakerMap).length > 0
      ? Object.values(speakerMap)
      : [organiserName, booking.clientName];

    // Generate structured summary via Claude Haiku
    const { summary, plainText: summaryPlainText } = await generateSummary(
      formattedForClaude,
      speakerNames,
    );

    // Build plain-text transcript with names substituted
    const namedTranscript = utterances
      ? substituteSpeakerNames(plainTranscript, speakerMap)
      : plainTranscript;

    // -----------------------------------------------------------------------
    // 5. Save to DB (upsert — replace if re-transcribing)
    // -----------------------------------------------------------------------
    const existing = await db
      .select({ id: meetingRecordings.id })
      .from(meetingRecordings)
      .where(eq(meetingRecordings.bookingId, bookingId))
      .limit(1);

    let recordingId: string;

    if (existing.length > 0) {
      recordingId = existing[0].id;
      await db
        .update(meetingRecordings)
        .set({
          transcriptText: namedTranscript,
          transcriptData: utterances,
          summaryText: summaryPlainText,
          summaryData: summary,
          speakerMap,
          recordedVia,
        })
        .where(eq(meetingRecordings.id, recordingId));
    } else {
      const [inserted] = await db
        .insert(meetingRecordings)
        .values({
          bookingId,
          transcriptText: namedTranscript,
          transcriptData: utterances,
          summaryText: summaryPlainText,
          summaryData: summary,
          speakerMap,
          recordedVia,
        })
        .returning({ id: meetingRecordings.id });
      recordingId = inserted.id;
    }

    return NextResponse.json({
      id: recordingId,
      transcriptData: utterances,
      transcriptText: namedTranscript,
      summaryData: summary,
      summaryText: summaryPlainText,
      speakerMap,
      speakerCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    console.error('[recordings/transcribe]', err);

    // Specific error messages for known failure modes
    if (message.includes('No speech detected')) {
      return NextResponse.json({ error: 'No speech detected in this recording.' }, { status: 422 });
    }
    if (message.includes('DEEPGRAM_API_KEY')) {
      return NextResponse.json({ error: 'Transcription service not configured.' }, { status: 503 });
    }
    if (message.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json({ error: 'Summary service not configured.' }, { status: 503 });
    }

    return NextResponse.json({ error: 'Transcription failed. Please try again.' }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/recordings/transcribe/route.ts
git commit -m "feat: add REST endpoint for audio transcription and transcript paste"
```

---

## Task 7: tRPC Recordings Router

**Files:**
- Create: `src/server/routers/recordings.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Write the tRPC router**

Create `src/server/routers/recordings.ts` with four procedures:
- `getByBooking` — fetch recording for a booking
- `updateSpeakers` — rename speakers, update plain-text versions
- `delete` — remove recording
- `regenerateSummary` — re-run Claude on existing transcript

The router follows the same pattern as `src/server/routers/invoices.ts` — uses `orgProcedure` for org-scoped access.

```typescript
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc';
import { meetingRecordings, bookings } from '@/lib/db/schema';
import { generateSummary } from '@/lib/ai/summarise';
import {
  formatTranscriptForSummary,
  substituteSpeakerNames,
} from '@/lib/ai/format-transcript';

export const recordingsRouter = router({
  getByBooking: orgProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify booking belongs to user's org
      const [booking] = await ctx.db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.id, input.bookingId), eq(bookings.orgId, ctx.orgId)))
        .limit(1);

      if (!booking) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found.' });
      }

      const [recording] = await ctx.db
        .select()
        .from(meetingRecordings)
        .where(eq(meetingRecordings.bookingId, input.bookingId))
        .limit(1);

      return recording ?? null;
    }),

  updateSpeakers: orgProcedure
    .input(z.object({
      recordingId: z.string().uuid(),
      speakerMap: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const [recording] = await ctx.db
        .select()
        .from(meetingRecordings)
        .where(eq(meetingRecordings.id, input.recordingId))
        .limit(1);

      if (!recording) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Recording not found.' });
      }

      // Verify booking belongs to user's org
      const [booking] = await ctx.db
        .select({ orgId: bookings.orgId })
        .from(bookings)
        .where(eq(bookings.id, recording.bookingId))
        .limit(1);

      if (!booking || booking.orgId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied.' });
      }

      // Rebuild plain-text transcript with new speaker names
      const updatedTranscript = recording.transcriptData
        ? substituteSpeakerNames(
            (recording.transcriptData as import('@/lib/db/schema').TranscriptUtterance[])
              .map((u) => `[Speaker ${u.speaker}] ${u.text}`)
              .join('\n'),
            input.speakerMap,
          )
        : recording.transcriptText;

      await ctx.db
        .update(meetingRecordings)
        .set({
          speakerMap: input.speakerMap,
          transcriptText: updatedTranscript,
        })
        .where(eq(meetingRecordings.id, input.recordingId));

      return { success: true };
    }),

  delete: orgProcedure
    .input(z.object({ recordingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [recording] = await ctx.db
        .select({ bookingId: meetingRecordings.bookingId })
        .from(meetingRecordings)
        .where(eq(meetingRecordings.id, input.recordingId))
        .limit(1);

      if (!recording) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Recording not found.' });
      }

      const [booking] = await ctx.db
        .select({ orgId: bookings.orgId })
        .from(bookings)
        .where(eq(bookings.id, recording.bookingId))
        .limit(1);

      if (!booking || booking.orgId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied.' });
      }

      await ctx.db
        .delete(meetingRecordings)
        .where(eq(meetingRecordings.id, input.recordingId));

      return { success: true };
    }),

  regenerateSummary: orgProcedure
    .input(z.object({ recordingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [recording] = await ctx.db
        .select()
        .from(meetingRecordings)
        .where(eq(meetingRecordings.id, input.recordingId))
        .limit(1);

      if (!recording) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Recording not found.' });
      }

      const [booking] = await ctx.db
        .select({ orgId: bookings.orgId })
        .from(bookings)
        .where(eq(bookings.id, recording.bookingId))
        .limit(1);

      if (!booking || booking.orgId !== ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied.' });
      }

      const speakerMap = (recording.speakerMap as Record<string, string>) ?? {};
      const utterances = recording.transcriptData as import('@/lib/db/schema').TranscriptUtterance[] | null;

      const formattedTranscript = utterances
        ? formatTranscriptForSummary(utterances, speakerMap)
        : recording.transcriptText ?? '';

      const speakerNames = Object.values(speakerMap).length > 0
        ? Object.values(speakerMap)
        : ['Organiser', 'Client'];

      const { summary, plainText } = await generateSummary(formattedTranscript, speakerNames);

      await ctx.db
        .update(meetingRecordings)
        .set({
          summaryData: summary,
          summaryText: plainText,
        })
        .where(eq(meetingRecordings.id, input.recordingId));

      return { summaryData: summary, summaryText: plainText };
    }),
});
```

**Step 2: Register router in _app.ts**

In `src/server/routers/_app.ts`, add:

```typescript
import { recordingsRouter } from './recordings';
```

And add to the router object:

```typescript
recordings: recordingsRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/recordings.ts src/server/routers/_app.ts
git commit -m "feat: add tRPC recordings router (get, updateSpeakers, delete, regenerateSummary)"
```

---

## Task 8: Bookings List Page (Prerequisite)

**Files:**
- Create: `src/app/(dashboard)/dashboard/bookings/page.tsx`

The transcription UI lives on the booking detail page, which doesn't exist yet. Neither does the bookings list page. Build a minimal list page first so users can navigate to individual bookings.

This is a basic table of bookings with links to the detail page. Follow the pattern of `src/app/(dashboard)/dashboard/invoices/page.tsx`.

Note: this task creates a minimal working list — not a full-featured bookings management page. Just enough to navigate to individual bookings.

**Step 1: Create the bookings list page**

Follow the same pattern as the invoices list page. Use `orgProcedure` to fetch bookings for the current org. Display: client name, booking type name, date/time, status. Each row links to `/dashboard/bookings/[id]`.

**Step 2: Commit**

```bash
git add src/app/(dashboard)/dashboard/bookings/page.tsx
git commit -m "feat: add minimal bookings list page for navigation to booking detail"
```

---

## Task 9: Booking Detail Page + Recording Section

**Files:**
- Create: `src/app/(dashboard)/dashboard/bookings/[id]/page.tsx`
- Create: `src/app/(dashboard)/dashboard/bookings/[id]/_components/recording-section.tsx`
- Create: `src/app/(dashboard)/dashboard/bookings/[id]/_components/summary-view.tsx`
- Create: `src/app/(dashboard)/dashboard/bookings/[id]/_components/transcript-view.tsx`
- Create: `src/app/(dashboard)/dashboard/bookings/[id]/_components/speaker-confirmation.tsx`

This is the largest task. It creates:
1. The booking detail page (shows booking info + recording section)
2. The recording section component (handles all three input methods + states)
3. The summary view (collapsible sections with action item badges)
4. The transcript view (conversation layout with speaker colours)
5. The speaker confirmation component (editable name fields)

**Step 1: Create the booking detail page**

The page fetches booking data via tRPC (`bookings.getById` — note: this procedure may need creating if it doesn't exist). Shows basic booking info (client, date, type, status) then the recording section below.

**Step 2: Create the recording section component**

Manages state machine: empty → recording/uploading → processing → speaker_confirmation → results.

Uses three input paths:
- "Upload Recording" — file input with validation (500MB max, accepted MIME types)
- "Record Meeting" — MediaRecorder with `isTypeSupported()` format detection, chunked recording, timer
- "Paste Transcript" — textarea or file upload for `.txt`/`.vtt` files

Sends to `/api/v1/recordings/transcribe` via fetch (not tRPC — multipart).

**Step 3: Create summary-view component**

Five collapsible `<Collapsible>` sections from shadcn/ui. Action Items expanded by default. Assignee shown as coloured badge. Count in header.

**Step 4: Create transcript-view component**

Conversation layout. Left-border colour per speaker (use CSS custom properties mapped from speaker index). Bold speaker name + faded timestamp. Text search via a simple filter input.

**Step 5: Create speaker-confirmation component**

Two editable `<Input>` fields pre-filled from booking data. "Swap" button swaps the two values. "Confirm" button calls `recordings.updateSpeakers` tRPC mutation.

**Step 6: Commit**

```bash
git add src/app/(dashboard)/dashboard/bookings/
git commit -m "feat: add booking detail page with recording, transcription, and summary UI"
```

---

## Task 10: useAudioRecorder Hook

**Files:**
- Create: `src/hooks/use-audio-recorder.ts`

Custom React hook for browser mic recording:
- Checks `MediaRecorder.isTypeSupported()` for best format (prefer `audio/webm;codecs=opus`, fall back to `audio/mp4`)
- `start()` — requests mic permission, begins chunked recording (`recorder.start(30000)`)
- `stop()` — stops recording, concatenates chunks into single Blob
- `elapsed` — reactive timer (seconds)
- `isRecording` — boolean state
- `audioBlob` — the recorded Blob after stopping
- `mimeType` — detected MIME type for file extension
- Max 2-hour auto-stop with warning

**Step 1: Write the hook**

**Step 2: Commit**

```bash
git add src/hooks/use-audio-recorder.ts
git commit -m "feat: add useAudioRecorder hook with format detection and chunked recording"
```

---

## Task 11: Add bookings.getById tRPC Procedure

**Files:**
- Create or modify: `src/server/routers/bookings.ts` (if it doesn't exist, create it)
- Modify: `src/server/routers/_app.ts` (register if new)

The booking detail page needs a tRPC procedure to fetch a single booking with its booking type name and organiser info. If a bookings router doesn't exist yet, create one with just `getById`.

**Step 1: Create the procedure**

```typescript
getById: orgProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    // Join bookings + bookingTypes + users (organiser)
    // Verify booking.orgId === ctx.orgId
    // Return booking with type name and organiser name
  })
```

**Step 2: Commit**

```bash
git add src/server/routers/bookings.ts src/server/routers/_app.ts
git commit -m "feat: add bookings.getById tRPC procedure for booking detail page"
```

---

## Task 12: Run All Tests + Verify TypeScript

**Step 1: Run vitest**

Run: `npx vitest run`
Expected: All tests pass (existing 41 + new format-transcript tests).

**Step 2: Check TypeScript**

Run: `npx tsc --noEmit`
Expected: Zero errors.

**Step 3: Check lint**

Run: `npm run lint`
Expected: No new errors from transcription code.

---

## Task 13: Final Commit + Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` — mark Step 13 as done, add recordings router to the router list
- Modify: `CONVERSATION-HANDOFF.md` — update with session progress

**Step 1: Update docs**

**Step 2: Commit**

```bash
git add CLAUDE.md CONVERSATION-HANDOFF.md
git commit -m "docs: mark Step 13 (AI transcription + summary) as complete"
```

---

## Environment Variables Required

The user must manually add these to `.env.local` (Claude cannot edit this file):

```
DEEPGRAM_API_KEY=your_deepgram_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Get the Deepgram key from https://console.deepgram.com ($200 free credit).
Get the Anthropic key from https://console.anthropic.com.
