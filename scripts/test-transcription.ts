/**
 * End-to-end transcription test
 *
 * Downloads audio already saved at test-data/test-podcast.webm,
 * runs it through Deepgram + Gemini, and compares against YouTube's
 * manual transcript at test-data/youtube-transcript.en.vtt
 *
 * Usage: npx tsx scripts/test-transcription.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync } from 'fs';
import { transcribeAudio } from '../src/lib/ai/deepgram';
import { generateMeetingSummary, formatSummary } from '../src/lib/ai/gemini';

function parseVTT(vttContent: string): string {
  const lines = vttContent.split('\n');
  const textLines: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed === 'WEBVTT' ||
      trimmed.startsWith('Kind:') ||
      trimmed.startsWith('Language:') ||
      trimmed.includes('-->')
    ) {
      continue;
    }
    // Strip VTT timing tags like <00:00:00.499><c>
    const clean = trimmed.replace(/<[^>]*>/g, '').trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      textLines.push(clean);
    }
  }
  return textLines.join(' ');
}

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  const wordsB = new Set(b.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

async function main() {
  console.log('=== Transcription Quality Test ===\n');
  console.log('Source: "President Obama and Jimmy Had an Awkward First Meeting"');
  console.log('Video: https://www.youtube.com/watch?v=2TtdPbeKNFc\n');

  // 1. Load audio
  console.log('1. Loading audio file...');
  const audioBuffer = readFileSync('test-data/test-podcast.webm');
  console.log(`   File size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // 2. Run Deepgram transcription
  console.log('2. Running Deepgram transcription (Nova-3)...');
  const startTranscribe = Date.now();
  const result = await transcribeAudio(audioBuffer);
  const transcribeTime = ((Date.now() - startTranscribe) / 1000).toFixed(1);
  console.log(`   Done in ${transcribeTime}s`);
  console.log(`   Detected language: ${result.detectedLanguage || 'unknown'}`);
  console.log(`   Speakers found: ${new Set(result.speakers.map((s) => s.speaker)).size}`);
  console.log(`   Utterances: ${result.speakers.length}`);
  console.log(`   Transcript length: ${result.transcript.length} chars\n`);

  // 3. Load YouTube reference transcript
  console.log('3. Loading YouTube reference transcript...');
  const vttContent = readFileSync('test-data/youtube-transcript.en.vtt', 'utf-8');
  const youtubeText = parseVTT(vttContent);
  console.log(`   YouTube transcript length: ${youtubeText.length} chars\n`);

  // 4. Compare transcripts
  console.log('4. Transcript comparison:');
  const overlap = wordOverlap(result.transcript, youtubeText);
  console.log(`   Word overlap (Jaccard): ${(overlap * 100).toFixed(1)}%`);

  const deepgramWords = result.transcript.toLowerCase().split(/\s+/).length;
  const youtubeWords = youtubeText.toLowerCase().split(/\s+/).length;
  console.log(`   Deepgram word count: ${deepgramWords}`);
  console.log(`   YouTube word count: ${youtubeWords}`);
  console.log(`   Word count ratio: ${(deepgramWords / youtubeWords * 100).toFixed(0)}%\n`);

  // 5. Run Gemini summary
  console.log('5. Running Gemini summary (2.5 Flash)...');
  const startSummary = Date.now();
  const summary = await generateMeetingSummary(result.transcript, result.speakers);
  const summaryTime = ((Date.now() - startSummary) / 1000).toFixed(1);
  console.log(`   Done in ${summaryTime}s\n`);

  // 6. Output results
  console.log('=== DEEPGRAM TRANSCRIPT ===\n');
  // Show first 500 chars
  console.log(result.transcript.substring(0, 500));
  if (result.transcript.length > 500) console.log('...[truncated]');

  console.log('\n=== SPEAKER SEGMENTS (first 10) ===\n');
  result.speakers.slice(0, 10).forEach((s) => {
    const mins = Math.floor(s.start / 60);
    const secs = Math.floor(s.start % 60);
    console.log(`  [${mins}:${secs.toString().padStart(2, '0')}] Speaker ${s.speaker}: ${s.text}`);
  });
  if (result.speakers.length > 10) console.log(`  ...[${result.speakers.length - 10} more]`);

  console.log('\n=== YOUTUBE REFERENCE (first 500 chars) ===\n');
  console.log(youtubeText.substring(0, 500));
  if (youtubeText.length > 500) console.log('...[truncated]');

  console.log('\n=== GEMINI SUMMARY ===\n');
  console.log(formatSummary(summary));

  console.log('\n=== QUALITY METRICS ===\n');
  console.log(`  Transcription time:  ${transcribeTime}s`);
  console.log(`  Summary time:        ${summaryTime}s`);
  console.log(`  Word overlap:        ${(overlap * 100).toFixed(1)}%`);
  console.log(`  Speakers detected:   ${new Set(result.speakers.map((s) => s.speaker)).size}`);
  console.log(`  Key points found:    ${summary.keyPoints.length}`);
  console.log(`  Action items found:  ${summary.actionItems.length}`);
  console.log(`  Decisions found:     ${summary.decisions.length}`);

  // Quality judgement
  console.log('\n=== VERDICT ===\n');
  if (overlap >= 0.7) {
    console.log('  TRANSCRIPT: EXCELLENT (70%+ word overlap with YouTube reference)');
  } else if (overlap >= 0.5) {
    console.log('  TRANSCRIPT: GOOD (50-70% word overlap with YouTube reference)');
  } else if (overlap >= 0.3) {
    console.log('  TRANSCRIPT: FAIR (30-50% word overlap — some loss)');
  } else {
    console.log('  TRANSCRIPT: POOR (under 30% word overlap — significant issues)');
  }

  if (summary.keyPoints.length > 0) {
    console.log('  SUMMARY: Generated successfully with structured data');
  } else {
    console.log('  SUMMARY: WARNING — no key points extracted');
  }
}

main().catch((err) => {
  console.error('\nFATAL ERROR:', err.message);
  process.exit(1);
});
