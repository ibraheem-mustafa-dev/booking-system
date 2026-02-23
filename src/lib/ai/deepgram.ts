import { createClient, type DeepgramClient } from '@deepgram/sdk';

let deepgram: DeepgramClient | null = null;

function getClient(): DeepgramClient {
  if (!deepgram) {
    if (!process.env.DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY environment variable is required');
    }
    deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  }
  return deepgram;
}

export interface TranscriptionResult {
  transcript: string;
  speakers: {
    speaker: number;
    text: string;
    start: number;
    end: number;
  }[];
  detectedLanguage?: string;
}

const DEEPGRAM_OPTIONS = {
  model: 'nova-3',
  smart_format: true,
  diarize: true,
  paragraphs: true,
  utterances: true,
  language: 'en-GB',
  detect_language: true,
} as const;

function parseResult(result: any): TranscriptionResult {
  if (!result?.results) {
    throw new Error('No transcription results returned from Deepgram');
  }

  const transcript = result.results.channels?.[0]?.alternatives?.[0]?.transcript || '';

  const speakers = (result.results.utterances || []).map((utterance: any) => ({
    speaker: utterance.speaker ?? 0,
    text: utterance.transcript,
    start: utterance.start,
    end: utterance.end,
  }));

  const detectedLanguage = result.results.channels?.[0]?.detected_language;

  return { transcript, speakers, detectedLanguage };
}

/**
 * Transcribe audio from a public URL.
 * Deepgram fetches the file directly — our server never touches the audio bytes.
 */
export async function transcribeFromUrl(url: string): Promise<TranscriptionResult> {
  const client = getClient();

  const { result, error } = await client.listen.prerecorded.transcribeUrl(
    { url },
    DEEPGRAM_OPTIONS
  );

  if (error) {
    throw new Error(`Deepgram transcription failed: ${error.message}`);
  }

  return parseResult(result);
}

/**
 * Transcribe audio from a Buffer (kept for small files / browser mic recordings).
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<TranscriptionResult> {
  const client = getClient();

  const { result, error } = await client.listen.prerecorded.transcribeFile(
    audioBuffer,
    DEEPGRAM_OPTIONS
  );

  if (error) {
    throw new Error(`Deepgram transcription failed: ${error.message}`);
  }

  return parseResult(result);
}
