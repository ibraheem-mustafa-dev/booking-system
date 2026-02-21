/**
 * Quick test: run coaching session audio through Deepgram + Gemini
 * and print the full structured summary JSON.
 *
 * Usage: npx tsx scripts/test-coaching-session.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync } from 'fs';
import { transcribeAudio } from '../src/lib/ai/deepgram';
import { generateMeetingSummary, formatSummary } from '../src/lib/ai/gemini';

async function main() {
  const audioPath = 'test-data/coaching-session.webm';
  console.log(`\n=== Coaching Session Test ===\n`);
  console.log(`Loading: ${audioPath}`);
  const audioBuffer = readFileSync(audioPath);
  console.log(`File size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  console.log('1. Running Deepgram transcription (Nova-3)...');
  const t1 = Date.now();
  const transcription = await transcribeAudio(audioBuffer);
  const transcribeTime = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`   Done in ${transcribeTime}s`);
  console.log(`   Speakers: ${new Set(transcription.speakers.map((s) => s.speaker)).size}`);
  console.log(`   Utterances: ${transcription.speakers.length}`);
  console.log(`   Transcript: ${transcription.transcript.length} chars\n`);

  console.log('2. Running Gemini summary (2.5 Flash) with NEW structured prompt...');
  const t2 = Date.now();
  const summary = await generateMeetingSummary(
    transcription.transcript,
    transcription.speakers
  );
  const summaryTime = ((Date.now() - t2) / 1000).toFixed(1);
  console.log(`   Done in ${summaryTime}s\n`);

  console.log('=== STRUCTURED SUMMARY JSON ===\n');
  console.log(JSON.stringify(summary, null, 2));

  console.log('\n=== FORMATTED MARKDOWN ===\n');
  console.log(formatSummary(summary));

  console.log('\n=== METRICS ===\n');
  console.log(`  Transcription time:  ${transcribeTime}s`);
  console.log(`  Summary time:        ${summaryTime}s`);
  console.log(`  Key points:          ${summary.keyPoints.length}`);
  console.log(`  Action items:        ${summary.actionItems.length}`);
  console.log(`  Decisions:           ${summary.decisions.length}`);
  console.log(`  Quotes:              ${summary.memorableFacts.quotes.length}`);
  console.log(`  Stats:               ${summary.memorableFacts.stats.length}`);
  console.log(`  Names:               ${summary.memorableFacts.names.length}`);
  console.log(`  Dates:               ${summary.memorableFacts.dates.length}`);
  console.log(`  URLs:                ${summary.mentionedUrls.length}`);
  console.log('');
}

main().catch(console.error);
