# AI Transcription & Summary — Design Document

**Date:** 14 February 2026
**Step:** 13 of Phase 1
**Status:** Approved

## What We're Building

A per-booking transcription and AI summary feature. The organiser uploads audio, records via browser mic, or pastes a transcript from a video call platform. The system transcribes the audio (via Deepgram), generates a structured summary (via Claude Haiku), and displays both on the booking detail page.

## Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Recording methods | Audio upload + browser mic + transcript paste | Covers IRL meetings (audio) and online meetings (paste platform transcript). Online auto-capture deferred to Phase 4. |
| UX location | Per-booking on booking detail page | Simplest approach. No standalone recordings page. |
| Audio storage | None — process then discard | Audio files are large, create GDPR liability, and the transcript is the valuable output. |
| Processing | Synchronous (~20-30s for audio, ~5s for text) | Self-hosted, no serverless timeouts. BullMQ available as fallback if needed later. |
| Transcription model | Deepgram Nova-3 | 94.7% accuracy (5.26% WER), better diarization than Nova-2, same pricing. |
| Summary model | Claude Haiku 4.5 | $1/$5 per million tokens. ~$0.01-0.08 per summary. Structured extraction is well within Haiku's capability. |
| Summary format | Structured JSON (5 sections) | Key Points, Decisions, Action Items (with assignee + deadline), Follow-ups, Next Steps. |
| Speaker identification | Pre-populated from booking data | Competitive advantage over Otter/Fireflies — we know the organiser and client names. User confirms or swaps. |
| File upload mechanism | Next.js REST route (not tRPC) | tRPC lacks native multipart/form-data support. REST route streams file to Deepgram. |
| Client sharing | Deferred | Build organiser-only view first. Sharing via email + public page is a future feature. |
| Configurable prompts | Deferred | Default structured prompt covers 80% of meeting types. Per-booking-type prompts are a Phase 4 enhancement. |

## Three Input Methods

### 1. Audio File Upload

Organiser uploads a recording (mp3, wav, m4a, webm, ogg, mp4, flac, aac). File streams to Deepgram Nova-3 with diarization. Claude Haiku generates the structured summary. Audio discarded after processing.

### 2. Browser Microphone

Organiser clicks "Record" on the booking detail page. Browser requests mic permission. MediaRecorder captures audio in chunks (`recorder.start(30000)`) to prevent memory exhaustion. Format detected per browser via `isTypeSupported()` — Chrome produces WebM/Opus, Safari produces MP4/AAC. After stopping:

- "Download Recording" button saves the file locally (the only copy)
- "Transcribe" button sends the blob through the same Deepgram + Claude pipeline

Max duration: 2 hours (browser mic). File upload has no duration limit (500MB size limit).

### 3. Transcript Text Upload/Paste

Organiser downloads the transcript from Google Meet, Zoom, or Teams, then pastes it or uploads the text file. Skips Deepgram entirely — goes straight to Claude Haiku for the structured summary. Zero transcription cost.

Future enhancement: pull transcripts automatically via platform APIs (Google Meet REST API, Zoom Cloud Recording API, Microsoft Graph API).

## Technical Architecture

### API Endpoints

**REST route** (file upload — tRPC cannot handle multipart):
- `POST /api/v1/recordings/transcribe` — accepts audio file (multipart/form-data) or transcript text (JSON). Requires authenticated user + booking ownership. Returns transcript + summary.

**tRPC procedures** (everything else):
- `recordings.getByBooking` — fetch transcript, summary, speaker map for a booking
- `recordings.updateSpeakers` — rename speakers, regenerate plain-text versions
- `recordings.delete` — remove transcript and summary data
- `recordings.regenerateSummary` — re-run Claude on existing transcript (e.g. after speaker rename)

### Deepgram Configuration

```
model: "nova-3"
diarize: true
utterances: true
smart_format: true
punctuate: true
```

Response: array of utterances with `speaker` (integer), `start`/`end` timestamps, `transcript` text, and `speaker_confidence`.

### Claude Haiku Prompt

Pre-processing: substitute speaker IDs with confirmed names. Format as `[Sarah, 00:01:23] Welcome, thanks for coming in today...`

```
You are analysing a meeting transcript between {speakerNames}.
Extract ONLY information explicitly stated in the transcript.
If a section has no relevant content, write "Nothing discussed."
Do NOT infer, assume, or speculate.

Return JSON with these sections:
- keyPoints: [{point, speaker}]
- decisions: [{decision, madeBy}]
- actionItems: [{description, assignee, deadline}]
  (deadline: only if explicitly mentioned, otherwise null)
- followUps: [{item, owner}]
- nextSteps: [{step, timeline}]
```

### Schema Changes

Add three JSONB columns to `meetingRecordings`:

| Column | Type | Purpose |
|---|---|---|
| `transcriptData` | jsonb | Utterance array with speaker IDs, timestamps, text |
| `summaryData` | jsonb | Structured summary (5 sections as JSON) |
| `speakerMap` | jsonb | Maps speaker IDs to names, e.g. `{"0": "Sarah", "1": "James"}` |

Existing `transcriptText` and `summaryText` columns remain as plain-text versions for search and export.

## UI Design

### Booking Detail Page — "Recording & Transcript" Section

**Empty state:**
Card with three buttons: "Upload Recording", "Record Meeting", "Paste Transcript". Helper text: "Transcribe a meeting to get AI-generated notes and action items."

**Browser mic recording:**
Red pulsing dot + elapsed timer. Large "Stop Recording" button (44px+, red). No pause/resume.

**Post-recording (before upload):**
"Download Recording" button + "Transcribe" button. Consent note: "Audio is sent to Deepgram for transcription then deleted. Not stored on our servers or used for AI training."

**Processing state:**
Step indicators with checkmarks: Uploading → Transcribing → Identifying speakers → Generating summary.

**Speaker confirmation (one-time):**
Editable name fields pre-filled from booking (organiser + client). "Swap" button + "Confirm" button.

**Results — tabbed view:**

*Summary tab (default):*
Five collapsible sections. Action Items expanded by default (highest value). Each action item shows assignee badge (coloured by speaker), description, deadline if mentioned. Section headers show bullet count ("Action Items (4)").

*Transcript tab:*
Conversation layout: bold speaker name + faded timestamp, utterance text below. Left-border colour per speaker for visual separation (not chat bubbles). Collapsible by default when summary is present. Text search within transcript.

**Management controls:**
"Re-transcribe" (upload new recording), "Delete transcript" (remove all data), "Edit speakers" (rename after initial confirmation).

## Error Handling

| Scenario | Response |
|---|---|
| Deepgram 5xx | Retry once after 3s. Show "Transcription service unavailable. Try again later." |
| Deepgram 429 | Show "Service busy. Try again in a moment." |
| Claude 5xx | Save transcript (it worked). Show "Summary generation failed — retry from transcript view." |
| Audio < 5 seconds | Reject client-side: "Recording too short to transcribe." |
| Audio > 500MB | Reject client-side: "Maximum file size is 500MB." |
| Browser mic > 2 hours | Auto-stop with warning. |
| No speech detected | Show "No speech detected in this recording." |
| Unsupported format | Show "Could not process this audio format. Try MP3 or WAV." |
| 1 speaker detected | Show confirmation step anyway — user decides how to proceed. |

## File Validation (Client-Side)

- Max file size: 500MB
- Accepted: `.mp3`, `.wav`, `.m4a`, `.webm`, `.ogg`, `.mp4`, `.flac`, `.aac`
- Min duration: 5 seconds (via Audio API)
- Browser mic format: detected via `isTypeSupported()` (WebM on Chrome, MP4 on Safari)
- Browser mic max: 2 hours
- Chunked recording: `recorder.start(30000)` — 30-second chunks

## Environment Variables

Both already listed in `.env.example`:
- `DEEPGRAM_API_KEY` — $200 free credit (~433 hours)
- `ANTHROPIC_API_KEY` — for Claude Haiku 4.5 summaries

## Future Enhancements (Deferred)

- **Configurable summary prompts per booking type** — organiser sets extraction template (coaching, sales, etc.)
- **Client-facing summary sharing** — email + token-authenticated public page
- **Automatic transcript pulling** — Google Meet REST API, Zoom Cloud Recording API, Microsoft Graph API
- **Online meeting auto-capture** — meeting bot service (Recall.ai or similar)

## Research Sources

- [Deepgram diarization docs](https://developers.deepgram.com/docs/diarization)
- [Deepgram Nova-3 vs Nova-2](https://deepgram.com/learn/model-comparison-when-to-use-nova-2-vs-nova-3-for-devs)
- [Deepgram pricing](https://deepgram.com/pricing) — $200 free credit, $0.0077/min PAYG
- [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) — Haiku 4.5: $1/$5 per MTok
- [tRPC file upload limitations](https://github.com/trpc/trpc/discussions/658)
- [iOS Safari MediaRecorder](https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription)
- [AssemblyAI meeting summary prompt patterns](https://www.assemblyai.com/blog/summarize-meetings-llms-python)
- [Otter.ai review (complaints)](https://tldv.io/blog/otter-ai-review/)
- [Fireflies.ai review (complaints)](https://tldv.io/blog/fireflies-review/)
