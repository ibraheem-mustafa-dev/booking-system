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

/**
 * Transcribe audio buffer with speaker diarization
 *
 * @param audioBuffer - Audio file as Buffer (WAV, MP3, FLAC, etc.)
 * @returns Transcript with speaker segmentation
 */
export async function transcribeAudio(
  audioBuffer: Buffer
): Promise<TranscriptionResult> {
  const client = getClient();

  const { result, error } = await client.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: 'nova-3',
      smart_format: true,
      diarize: true,
      paragraphs: true,
      utterances: true,
      language: 'en-GB',
      detect_language: true,
    }
  );

  if (error) {
    throw new Error(`Deepgram transcription failed: ${error.message}`);
  }

  if (!result?.results) {
    throw new Error('No transcription results returned from Deepgram');
  }

  const transcript = result.results.channels?.[0]?.alternatives?.[0]?.transcript || '';

  const speakers = (result.results.utterances || []).map((utterance) => ({
    speaker: utterance.speaker ?? 0,
    text: utterance.transcript,
    start: utterance.start,
    end: utterance.end,
  }));

  const detectedLanguage = result.results.channels?.[0]?.detected_language;

  return {
    transcript,
    speakers,
    detectedLanguage,
  };
}
