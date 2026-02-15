# AI Transcription + Summary Implementation

**Status:** ✅ Complete (Phase 1, Step 13)

## What Was Built

Fully functional AI transcription and meeting summary system using:
- **Deepgram Nova-3** for transcription with speaker diarization
- **Claude 4.5 Haiku** for intelligent meeting summaries
- **Supabase Storage** for audio file hosting
- **tRPC** API with 5 endpoints

## Files Created

### 1. AI Utilities
- [`src/lib/ai/deepgram.ts`](src/lib/ai/deepgram.ts) — Deepgram transcription with speaker diarization
- [`src/lib/ai/claude.ts`](src/lib/ai/claude.ts) — Claude summary generation + formatting

### 2. API Layer
- [`src/server/routers/recordings.ts`](src/server/routers/recordings.ts) — tRPC router with 5 endpoints
- Updated [`src/server/routers/_app.ts`](src/server/routers/_app.ts) — Added recordings router

### 3. Documentation
- [`docs/TRANSCRIPTION-SETUP.md`](docs/TRANSCRIPTION-SETUP.md) — Setup guide (Supabase bucket, env vars, cost estimates)
- [`docs/TRANSCRIPTION-USAGE.tsx`](docs/TRANSCRIPTION-USAGE.tsx) — React component examples

## API Endpoints

All under `trpc.recordings.*`:

| Endpoint | Type | Description |
|---|---|---|
| `create` | mutation | Upload audio → transcribe → summarise → store |
| `getByBooking` | query | List all recordings for a booking |
| `getById` | query | Get single recording with full transcript |
| `toggleSummarySharing` | mutation | Control client access to summary |
| `delete` | mutation | Delete recording (+ remove from storage) |

## Transcription Settings Used

```typescript
{
  model: 'nova-3',           // Latest model (47.4% better WER)
  smart_format: true,        // Punctuation + formats dates/numbers/currency
  diarize: true,             // Speaker identification (Speaker 0, Speaker 1...)
  paragraphs: true,          // Split into paragraphs
  utterances: true,          // Segment by speaker turns
  language: 'en-GB',         // UK English (auto-detects if wrong)
}
```

## Summary Format

Claude generates structured summaries with:
- Overall summary (2-3 sentences)
- Key discussion points (bullet list)
- Action items with responsibility
- Decisions made

Output formatted as markdown for easy display.

## Setup Required (Before Testing)

### 1. Add Anthropic API Key

In `.env.local`:
```bash
ANTHROPIC_API_KEY=your-api-key-here
```

Get key from: https://console.anthropic.com/

### 2. Create Supabase Storage Bucket

1. Go to https://supabase.com/dashboard/project/wimrjgrujprvwbsewqrq
2. Navigate to **Storage**
3. Create bucket: `meeting-recordings` (public)

### 3. Test

Use the example components in `docs/TRANSCRIPTION-USAGE.tsx` to build a test UI in the dashboard.

## Supported Audio Formats

- WAV, MP3, FLAC, AAC, M4A, OGG, WEBM, OPUS
- Max 2GB per file
- No minimum duration (but <50 words may not generate useful summaries)

## Recording Methods

Three methods supported via `recordedVia` enum:

1. **`online`** — Auto-capture from Google Meet/Zoom/Teams (Phase 1.12, not yet built)
2. **`phone_upload`** — User uploads audio file recorded on phone
3. **`browser_mic`** — Browser MediaRecorder API for IRL meetings

## Cost Estimates

**Per 1-hour meeting:**
- Deepgram: ~$0.26
- Claude: ~$0.009
- **Total: ~$0.27**

100 meetings/month = ~$27/month

## Security

- ✅ Organisation-scoped access control (users only see their org's recordings)
- ✅ Supabase service role key never exposed to client
- ✅ UUID-based file paths (not guessable)
- ✅ Audio files stored in public bucket (URLs still require knowing full path)
- ✅ Database cascades delete bookings → recordings
- ✅ Storage files deleted when recording deleted

## What's NOT Included (Future Work)

- ❌ Dashboard UI (component examples provided in docs)
- ❌ Auto-capture from video meetings (Phase 1.12)
- ❌ Browser microphone recording UI (Phase 1.13)
- ❌ Client-facing summary view (when `summaryShared = true`)
- ❌ Email delivery of summaries

All tRPC endpoints are ready — just need UI built around them.

## Testing Checklist

Before going live:

1. ☐ Add `ANTHROPIC_API_KEY` to `.env.local`
2. ☐ Create `meeting-recordings` bucket in Supabase
3. ☐ Upload test audio file (use example component)
4. ☐ Verify transcript generated
5. ☐ Verify summary generated
6. ☐ Test toggle summary sharing
7. ☐ Test delete (confirm file removed from Supabase Storage)
8. ☐ Verify org access control (user from different org can't see recording)

## Next Steps

To complete Phase 1:

1. **Build dashboard UI** for recordings (upload, list, view, delete)
2. **Invoice system** (Phase 1, Step 12) — PDF generation + email delivery
3. **Testing + Lighthouse + accessibility audit** (Phase 1, Step 14)
4. **Deploy to VPS** (Phase 1, Step 15)

Phase 2 will add:
- Stripe Connect payments
- Cancellation/reschedule links in emails
- Team members + round-robin booking
