# Recording Summary UI Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the recording detail page from raw-text dump to a structured, Teams-inspired meeting recap with accordion key points, categorised facts/phrases, URL extraction, checklist action items, copy buttons, and speaker label editing.

**Architecture:** The Gemini prompt returns structured JSON (not markdown). The structured data is stored in a new `summaryJson` JSONB column alongside the existing `summaryText` (kept for backwards compatibility). The UI reads `summaryJson` and renders each section with dedicated components. Speaker labels are stored per-recording as JSONB and applied at render time.

**Tech Stack:** React 19, shadcn/ui (Accordion, Collapsible, Badge), react-markdown, Drizzle ORM, tRPC v11, Gemini 2.5 Flash

---

### Task 1: Add schema columns + generate migration

**Files:**
- Modify: `src/lib/db/schema.ts:354-365` (meetingRecordings table)

**Step 1: Add two JSONB columns to meetingRecordings**

In `src/lib/db/schema.ts`, add after the `summaryText` column:

```typescript
summaryJson: jsonb('summary_json').$type<{
  summary: string;
  keyPoints: { title: string; detail: string }[];
  actionItems: { text: string; owner?: string }[];
  decisions: string[];
  memorableFacts: {
    quotes: string[];
    stats: string[];
    names: string[];
    dates: string[];
  };
  mentionedUrls: { url: string; context: string }[];
}>(),
speakerLabels: jsonb('speaker_labels').$type<Record<string, string>>().default({}),
```

Both nullable — existing recordings won't have them.

**Step 2: Generate migration**

Run: `npx drizzle-kit generate`
Expected: New migration file in `supabase/migrations/`

**Step 3: Push to database**

Run: `npx drizzle-kit push`
Expected: Schema synced to Supabase Cloud

**Step 4: Commit**

```bash
git add src/lib/db/schema.ts supabase/migrations/
git commit -m "feat: add summaryJson + speakerLabels columns to meetingRecordings"
```

---

### Task 2: Update MeetingSummary interface + Gemini prompt

**Files:**
- Modify: `src/lib/ai/gemini.ts` (entire file)

**Step 1: Replace the MeetingSummary interface**

```typescript
export interface MeetingSummary {
  summary: string;
  keyPoints: { title: string; detail: string }[];
  actionItems: { text: string; owner?: string }[];
  decisions: string[];
  memorableFacts: {
    quotes: string[];
    stats: string[];
    names: string[];
    dates: string[];
  };
  mentionedUrls: { url: string; context: string }[];
}
```

**Step 2: Update the Gemini prompt**

Replace the prompt string in `generateMeetingSummary()` with:

```typescript
const result = await model.generateContent(
  `You are a meeting analyst. Analyse this transcript and extract structured data.

RULES:
- Do NOT infer, assume, or speculate
- Do NOT fabricate names, dates, or details not in the transcript
- Use UK English spelling (summarise, organise, colour, etc.)
- If a section has no content, use empty arrays
- For keyPoints, each must have a short title (3-6 words) and a detail paragraph (2-3 sentences explaining the discussion)
- For actionItems, include who is responsible if mentioned (use "Speaker N" if no name given)
- For memorableFacts, extract ONLY items explicitly stated in the transcript:
  - quotes: Notable or impactful phrases said verbatim (wrap in quotation marks)
  - stats: Numbers, percentages, monetary amounts, quantities
  - names: People, companies, products, titles mentioned
  - dates: Specific dates, deadlines, timeframes mentioned
- For mentionedUrls: Extract any website URLs, domain names, or web references mentioned. Include the context of why it was mentioned

Format your response as JSON:
{
  "summary": "2-3 sentence overview",
  "keyPoints": [{ "title": "Short title", "detail": "2-3 sentences about the discussion" }],
  "actionItems": [{ "text": "Action description", "owner": "Speaker N or name" }],
  "decisions": ["Decision 1"],
  "memorableFacts": {
    "quotes": ["\\"We need to move fast\\""],
    "stats": ["£45,000 budget", "85% completion"],
    "names": ["Sarah from Finance", "Acme Corp"],
    "dates": ["15 March deadline", "Q3 2026"]
  },
  "mentionedUrls": [{ "url": "example.com/proposal", "context": "Shared as reference for pricing" }]
}

Transcript:

${formattedTranscript}`
);
```

**Step 3: Update the response parsing**

Replace the return block:

```typescript
return {
  summary: parsed.summary || '',
  keyPoints: Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints.map((kp: { title?: string; detail?: string } | string) =>
        typeof kp === 'string' ? { title: kp, detail: '' } : { title: kp.title || '', detail: kp.detail || '' }
      )
    : [],
  actionItems: Array.isArray(parsed.actionItems)
    ? parsed.actionItems.map((ai: { text?: string; owner?: string } | string) =>
        typeof ai === 'string' ? { text: ai } : { text: ai.text || '', owner: ai.owner }
      )
    : [],
  decisions: parsed.decisions || [],
  memorableFacts: {
    quotes: parsed.memorableFacts?.quotes || [],
    stats: parsed.memorableFacts?.stats || [],
    names: parsed.memorableFacts?.names || [],
    dates: parsed.memorableFacts?.dates || [],
  },
  mentionedUrls: Array.isArray(parsed.mentionedUrls)
    ? parsed.mentionedUrls.map((u: { url?: string; context?: string } | string) =>
        typeof u === 'string' ? { url: u, context: '' } : { url: u.url || '', context: u.context || '' }
      )
    : [],
};
```

Note: The defensive `typeof` checks handle cases where Gemini returns the old flat format.

**Step 4: Update formatSummary for backwards compat**

Update `formatSummary()` to handle the new structure (still generates markdown for `summaryText` column):

```typescript
export function formatSummary(summary: MeetingSummary): string {
  let formatted = `${summary.summary}\n\n`;

  if (summary.keyPoints.length > 0) {
    formatted += '## Key Points\n\n';
    summary.keyPoints.forEach((point) => {
      formatted += `### ${point.title}\n${point.detail}\n\n`;
    });
  }

  if (summary.decisions.length > 0) {
    formatted += '## Decisions Made\n\n';
    summary.decisions.forEach((decision) => {
      formatted += `- ${decision}\n`;
    });
    formatted += '\n';
  }

  if (summary.actionItems.length > 0) {
    formatted += '## Action Items\n\n';
    summary.actionItems.forEach((item) => {
      const owner = item.owner ? ` (${item.owner})` : '';
      formatted += `- ${item.text}${owner}\n`;
    });
    formatted += '\n';
  }

  const facts = summary.memorableFacts;
  const hasAnyFacts = facts.quotes.length + facts.stats.length + facts.names.length + facts.dates.length > 0;
  if (hasAnyFacts) {
    formatted += '## Facts & Phrases\n\n';
    if (facts.quotes.length > 0) formatted += facts.quotes.map((q) => `- ${q}`).join('\n') + '\n';
    if (facts.stats.length > 0) formatted += facts.stats.map((s) => `- ${s}`).join('\n') + '\n';
    if (facts.names.length > 0) formatted += facts.names.map((n) => `- ${n}`).join('\n') + '\n';
    if (facts.dates.length > 0) formatted += facts.dates.map((d) => `- ${d}`).join('\n') + '\n';
    formatted += '\n';
  }

  if (summary.mentionedUrls.length > 0) {
    formatted += '## Mentioned URLs\n\n';
    summary.mentionedUrls.forEach((u) => {
      formatted += `- ${u.url}${u.context ? ` — ${u.context}` : ''}\n`;
    });
    formatted += '\n';
  }

  return formatted.trim();
}
```

**Step 5: Commit**

```bash
git add src/lib/ai/gemini.ts
git commit -m "feat: extend MeetingSummary with facts, URLs, structured key points"
```

---

### Task 3: Update recordings router to store/serve structured JSON

**Files:**
- Modify: `src/server/routers/recordings.ts`

**Step 1: Update create mutation to store summaryJson**

In the `create` mutation, after `const summaryText = formatSummary(summaryData);`, update the insert:

```typescript
const [recording] = await db
  .insert(meetingRecordings)
  .values({
    bookingId: input.bookingId,
    transcriptText: transcription.transcript,
    summaryText,
    summaryJson: summaryData,
    summaryShared: false,
    recordingUrl,
    recordedVia: input.recordedVia,
  })
  .returning();
```

**Step 2: Add updateSpeakerLabels mutation**

Add after `toggleSummarySharing`:

```typescript
updateSpeakerLabels: orgProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      speakerLabels: z.record(z.string(), z.string()),
    })
  )
  .mutation(async ({ ctx, input }) => {
    // Verify access (same pattern as toggleSummarySharing)
    const recording = await db
      .select({
        recording: meetingRecordings,
        booking: { orgId: bookings.orgId },
      })
      .from(meetingRecordings)
      .innerJoin(bookings, eq(meetingRecordings.bookingId, bookings.id))
      .where(eq(meetingRecordings.id, input.id))
      .limit(1);

    if (!recording[0]) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Recording not found' });
    }
    if (recording[0].booking.orgId !== ctx.orgId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this recording' });
    }

    await db
      .update(meetingRecordings)
      .set({ speakerLabels: input.speakerLabels })
      .where(eq(meetingRecordings.id, input.id));

    return { success: true };
  }),
```

**Step 3: Commit**

```bash
git add src/server/routers/recordings.ts
git commit -m "feat: store summaryJson, add speaker label update mutation"
```

---

### Task 4: Install dependencies

**Step 1: Install react-markdown + remark-gfm**

Run: `npm install react-markdown remark-gfm`

**Step 2: Install shadcn accordion + collapsible**

Run: `npx shadcn@latest add accordion collapsible`

**Step 3: Verify installs**

Run: `ls src/components/ui/accordion.tsx src/components/ui/collapsible.tsx`
Expected: Both files exist

**Step 4: Commit**

```bash
git add package.json package-lock.json src/components/ui/accordion.tsx src/components/ui/collapsible.tsx
git commit -m "chore: install react-markdown, shadcn accordion + collapsible"
```

---

### Task 5: Build MeetingSummaryView component

**Files:**
- Create: `src/app/(dashboard)/dashboard/recordings/[id]/_components/meeting-summary-view.tsx`

This is the main component that renders the structured summary. It receives `summaryJson` and `speakerLabels` as props. It contains:

1. **Overview section** — summary paragraph rendered with react-markdown
2. **Key Points accordion** — shadcn Accordion with title + detail
3. **Facts & Phrases** — categorised badges (quotes, stats, names, dates)
4. **Mentioned URLs** — clickable links with context
5. **Action Items** — checklist cards with owner
6. **Decisions** — styled list

Each section has a copy button in its header. Empty sections are hidden.

**Step 1: Create the component file**

Build `meeting-summary-view.tsx` with all sections. Use these sub-components inline (no separate files — single component under 250 lines):
- `SectionHeader` — title + copy button
- `FactsBadgeGroup` — category label + badge chips
- `ActionItemCard` — checkbox + text + owner

Speaker labels: Replace "Speaker N" in all text with the label from the `speakerLabels` map using a helper function.

**Key implementation details:**
- `react-markdown` with `remark-gfm` for the overview section
- shadcn `Accordion` / `AccordionItem` / `AccordionTrigger` / `AccordionContent` for key points
- shadcn `Badge` for facts chips
- `navigator.clipboard.writeText()` for copy, wrapped in try/catch with Sonner toast feedback
- Copy button: small ghost button with `Copy` icon from lucide-react, changes to `Check` icon for 2 seconds after click
- All text is run through `applySpeakerLabels(text, speakerLabels)` before rendering

**Step 2: Commit**

```bash
git add src/app/(dashboard)/dashboard/recordings/[id]/_components/meeting-summary-view.tsx
git commit -m "feat: add MeetingSummaryView component with structured sections"
```

---

### Task 6: Build speaker label editor component

**Files:**
- Create: `src/app/(dashboard)/dashboard/recordings/[id]/_components/speaker-label-editor.tsx`

A small inline editor that shows detected speaker numbers and lets the user type a name for each. Uses shadcn `Input` + `Button`. Saves via the `updateSpeakerLabels` tRPC mutation.

**Key implementation details:**
- Extracts unique speaker numbers from the transcript text (regex: `/Speaker (\d+)/g`)
- Shows a row per speaker: "Speaker 0:" + input field + save button
- On save, calls `trpc.recordings.updateSpeakerLabels.mutate()` and invalidates the recording query
- Compact design — collapsible by default, "Edit speaker names" toggle to expand

**Step 1: Create the component file**

**Step 2: Commit**

```bash
git add src/app/(dashboard)/dashboard/recordings/[id]/_components/speaker-label-editor.tsx
git commit -m "feat: add speaker label editor component"
```

---

### Task 7: Rebuild recording detail page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/recordings/[id]/page.tsx`

**Step 1: Replace the summary card**

Remove the existing `{/* Summary */}` card (lines 218-254). Replace with:

```tsx
{/* AI Summary */}
{recording.summaryJson ? (
  <MeetingSummaryView
    summary={recording.summaryJson}
    speakerLabels={recording.speakerLabels ?? {}}
  />
) : recording.summaryText ? (
  <Card>
    <CardHeader>
      <CardTitle>AI Summary</CardTitle>
    </CardHeader>
    <CardContent>
      <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm dark:prose-invert max-w-none">
        {recording.summaryText}
      </ReactMarkdown>
    </CardContent>
  </Card>
) : null}
```

This handles three cases:
1. New recordings with `summaryJson` — full structured UI
2. Old recordings with only `summaryText` — markdown rendering (still an upgrade from `<pre>`)
3. No summary — hidden

**Step 2: Add speaker label editor**

Add the `SpeakerLabelEditor` component between the metadata card and the summary, inside a collapsible section.

**Step 3: Add "Share with client" toggle to the summary header**

Move the existing share toggle into the `MeetingSummaryView` header area.

**Step 4: Make transcript collapsible**

Wrap the transcript card content in a shadcn `Collapsible` component, collapsed by default for long transcripts (>500 chars).

**Step 5: Add "Copy full summary" button**

In the summary header, add a button that copies the `formatSummary()` output to clipboard.

**Step 6: Verify the page renders**

Run: `npm run dev` and navigate to an existing recording
Expected: Page loads without errors. Old recording shows markdown-rendered `summaryText` fallback.

**Step 7: Commit**

```bash
git add src/app/(dashboard)/dashboard/recordings/[id]/page.tsx
git commit -m "feat: redesign recording page with structured summary UI"
```

---

### Task 8: Test with a new recording upload

**Step 1: Upload a test recording via the browser UI**

Navigate to `/dashboard/recordings`, upload `test-data/test-podcast.webm` for any booking.

**Step 2: Verify the new structured summary renders**

- Overview section with rendered markdown
- Accordion key points (expand one to check detail text)
- Facts & Phrases section with categorised badges
- Action items (may be empty for a podcast — that's correct)
- Mentioned URLs (may be empty — that's correct)
- Empty sections should be hidden

**Step 3: Test speaker label editing**

- Click "Edit speaker names"
- Enter names for Speaker 0 and Speaker 1
- Save and verify names appear throughout the summary and transcript

**Step 4: Test copy buttons**

- Click copy on a section header — verify toast appears and clipboard has content
- Click "Copy full summary" — verify full formatted text is in clipboard

**Step 5: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: recording summary UI adjustments after testing"
```

---

### Task 9: Run build + existing tests

**Step 1: Run tests**

Run: `npx vitest run`
Expected: All 41+ tests pass (no tests touch recording UI — these are unit tests for availability, ics, email, invoice)

**Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with 0 errors

**Step 3: Commit any fixes**

If build errors appear, fix and commit.

---

## Summary of files touched

| Action | File |
|--------|------|
| Modify | `src/lib/db/schema.ts` |
| Modify | `src/lib/ai/gemini.ts` |
| Modify | `src/server/routers/recordings.ts` |
| Modify | `src/app/(dashboard)/dashboard/recordings/[id]/page.tsx` |
| Create | `src/app/(dashboard)/dashboard/recordings/[id]/_components/meeting-summary-view.tsx` |
| Create | `src/app/(dashboard)/dashboard/recordings/[id]/_components/speaker-label-editor.tsx` |
| Create | `src/components/ui/accordion.tsx` (via shadcn) |
| Create | `src/components/ui/collapsible.tsx` (via shadcn) |
| Create | `supabase/migrations/XXXX_*.sql` (via drizzle-kit) |
| Modify | `package.json` + `package-lock.json` |

## Notes for future sessions

- **CRM/tool integration for action items** — Phase 4 feature. n8n webhooks can pipe action items, decisions, and facts to any CRM/project tool. Add a webhook trigger in the recordings router after summary generation.
- **Re-summarise button** — add a "Regenerate summary" button that re-runs the Gemini prompt on the existing transcript. Useful after prompt improvements.
- **Speaker labels shared across recordings** — currently per-recording. Could later be per-booking or per-org for repeat participants.
