# AI Transcription & Summary Setup

This system uses **Deepgram** for transcription and **Claude (Anthropic)** for meeting summaries.

## Prerequisites

### 1. Environment Variables

Add to `.env.local`:

```bash
# Already added:
DEEPGRAM_API_KEY=766d8998654b965e4d393f3c0c26fed7e44a64f3

# REQUIRED - Add your Anthropic API key:
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

**Get your Anthropic API key:**
1. Go to https://console.anthropic.com/
2. Create account or sign in
3. Navigate to API Keys section
4. Create new key
5. Copy and paste into `.env.local`

### 2. Supabase Storage Bucket

Create a `meeting-recordings` bucket in Supabase:

1. Go to https://supabase.com/dashboard/project/wimrjgrujprvwbsewqrq
2. Navigate to **Storage** in sidebar
3. Click **New bucket**
4. Bucket name: `meeting-recordings`
5. Public bucket: **Yes** (files accessible via public URL)
6. Click **Create bucket**

**RLS Policy (optional but recommended):**
- Add policy to restrict uploads to authenticated users only
- Public read access is fine (URLs are not guessable)

## How It Works

### Transcription Flow

1. User uploads audio file (via dashboard or browser recording)
2. File uploaded to Supabase Storage (`meeting-recordings/[bookingId]/[timestamp]-[filename]`)
3. Deepgram transcribes with settings:
   - Model: `nova-3` (latest, 47.4% better accuracy)
   - `smart_format: true` (punctuation + formats dates/numbers/currency)
   - `diarize: true` (speaker identification: Speaker 0, Speaker 1, etc.)
   - `paragraphs: true` (split into paragraphs)
   - `utterances: true` (segment by speaker turns)
   - `language: en-GB` (UK English, with auto-detect fallback)

4. Claude Haiku generates summary:
   - Overall summary (2-3 sentences)
   - Key discussion points
   - Action items (with who's responsible)
   - Decisions made

5. Results stored in `meeting_recordings` table

### API Endpoints

All endpoints under `trpc.recordings.*`:

- `recordings.create` — Upload + transcribe + summarise
- `recordings.getByBooking` — List all recordings for a booking
- `recordings.getById` — Get single recording with full transcript
- `recordings.toggleSummarySharing` — Control whether client sees summary
- `recordings.delete` — Delete recording (removes from storage too)

## Supported Audio Formats

Deepgram supports:
- WAV
- MP3
- FLAC
- AAC
- M4A
- OGG
- WEBM
- OPUS

No file size limit (2GB max via Deepgram API).

## Recording Methods

Three methods supported (stored in `recorded_via` enum):

1. **`online`** — Auto-captured from video meeting (Phase 1.12 - Google Meet/Zoom/Teams)
2. **`phone_upload`** — User uploads audio file recorded on phone
3. **`browser_mic`** — Browser MediaRecorder API (PWA approach for IRL meetings)

## Cost Estimates

**Deepgram Nova-3 pricing (pay-as-you-go):**
- Pre-recorded: $0.0043 per minute
- 1-hour meeting: ~$0.26

**Anthropic Claude Haiku pricing:**
- Input: $0.25 per million tokens
- Output: $1.25 per million tokens
- Typical 1-hour transcript (~15k tokens): ~$0.004 input + ~$0.005 output = **$0.009**

**Total cost per 1-hour meeting: ~$0.27**

100 meetings/month = ~$27/month.

## Error Handling

All AI operations wrapped in try/catch:
- Deepgram failures return clear error message
- Claude failures fall back to transcript-only (no summary)
- File upload failures rollback (no orphaned files)

## Security

- Supabase service role key used server-side only (never exposed to client)
- Audio files stored with UUID-based paths (not guessable)
- Organisation-scoped access control (users can only see their org's recordings)
- RLS policies on `meeting_recordings` table enforce access control

## Testing

Use the dashboard to test:
1. Create a test booking
2. Upload a short audio file (~30 seconds)
3. Verify transcript appears
4. Verify summary is generated
5. Test toggle summary sharing
6. Test delete (confirm file removed from storage)
