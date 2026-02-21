# Recording Upload UI — User Guide

## Pages Built

### 1. Upload Page
**Location:** `/dashboard/recordings`

**Features:**
- Select a booking from dropdown (fetches your recent 50 bookings)
- Upload audio file (drag-and-drop would be nice future enhancement)
- Real-time upload progress with status messages
- Supported formats: WAV, MP3, M4A, FLAC, OGG, WEBM
- Max file size: 100MB
- Automatic redirect to detail page when complete

**Status Flow:**
1. `idle` → Select booking + choose file
2. `uploading` → File being read and encoded
3. `transcribing` → Deepgram + Claude processing (30-60 seconds)
4. `success` → Redirect to detail view
5. `error` → Shows error message, retry available

### 2. Detail Page
**Location:** `/dashboard/recordings/[id]`

**Features:**
- Audio playback player
- AI summary with key points, decisions, action items
- Toggle "share with client" switch
- Full transcript (speaker-identified if multiple speakers detected)
- Delete recording (with confirmation dialog)

## User Flow

1. **Go to** `/dashboard/recordings`
2. **Select a booking** from the dropdown
3. **Click "Choose Audio File"**
4. **Select** your audio file (phone recording, Zoom download, etc.)
5. **Wait** 30-60 seconds while:
   - File uploads to Supabase Storage
   - Deepgram transcribes with speaker diarization
   - Claude generates summary
6. **Auto-redirect** to detail page
7. **Review** transcript and summary
8. **Toggle** client sharing if you want them to see the summary
9. **Delete** if needed (removes from storage too)

## Testing Checklist

Before production:

1. ☐ Upload a short test audio file (30 seconds)
2. ☐ Verify transcript appears correctly
3. ☐ Verify summary has sections (Summary, Key Points, Decisions, Action Items)
4. ☐ Test toggle client sharing (check database updates)
5. ☐ Test audio playback
6. ☐ Test delete (confirm file removed from Supabase Storage)
7. ☐ Test with long audio file (5+ minutes)
8. ☐ Test with different formats (WAV, MP3, M4A)
9. ☐ Test error handling (invalid file type, too large, network error)
10. ☐ Test mobile responsiveness (especially file upload button)

## Known Limitations (MVP)

- No drag-and-drop upload (just file picker)
- No progress bar during transcription (just spinner)
- No bulk upload (one at a time)
- No browser microphone recording yet (Phase 1.13)
- No automatic capture from video meetings yet (Phase 1.12)
- No client-facing summary view (they can't see it even if shared)
- No email delivery of summaries
- No search/filter on recordings list

## Future Enhancements (Post-MVP)

1. **Drag-and-drop upload** — Better UX than file picker
2. **Progress estimation** — Show % complete during transcription
3. **Recordings list page** — View all recordings across all bookings
4. **Search & filter** — Find recordings by date, booking, keywords
5. **Export transcript** — Download as TXT, PDF, DOCX
6. **Email summary** — Send to client via email
7. **Browser recording** — Record directly in browser for IRL meetings
8. **Auto-capture** — Auto-download recordings from Google Meet/Zoom
9. **Speaker labels** — Let user rename "Speaker 0" to actual names
10. **Highlight quotes** — Let user highlight key quotes for reuse

## Troubleshooting

**"Please select a booking first"**
- No bookings exist yet — create a test booking via public booking page

**"File too large"**
- Limit is 100MB for MVP — compress or split audio

**"Unsupported file type"**
- Use WAV, MP3, M4A, FLAC, OGG, or WEBM
- If using phone voice memo, export as M4A or MP3

**"Transcription failed: [error]"**
- Check browser console for details
- Verify DEEPGRAM_API_KEY and ANTHROPIC_API_KEY are set
- Check Supabase Storage bucket exists (`meeting-recordings`)
- Verify audio file is not corrupted (try playing locally first)

**Recording uploaded but no summary**
- Check if transcript is very short (<50 words) — Claude may skip summary
- Check browser console for Claude API errors
- Verify ANTHROPIC_API_KEY is valid

**Toggle sharing doesn't work**
- Check browser console for tRPC errors
- Verify database `meeting_recordings` table has `summary_shared` column
- Check user has org access (org-scoped procedure)

## Cost Monitoring

Track actual costs:
- **Deepgram:** Check https://console.deepgram.com/usage
- **Anthropic:** Check https://console.anthropic.com/settings/billing

Expected:
- ~$0.27 per 1-hour recording
- 10 recordings/month = ~$2.70/month
- 100 recordings/month = ~$27/month

If costs exceed estimates, check:
- Are you uploading video files? (Much larger, same transcription cost)
- Are recordings longer than expected?
- Are failed uploads retrying multiple times?
