import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

export interface MeetingSummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
}

/**
 * Generate meeting summary from transcript using Gemini 2.5 Flash
 *
 * Uses Gemini 2.5 Flash for fast, cost-effective summarisation with speaker context
 *
 * @param transcript - Full meeting transcript text
 * @param speakers - Array of speaker segments with timestamps
 * @returns Structured meeting summary
 */
export async function generateMeetingSummary(
  transcript: string,
  speakers: { speaker: number; text: string; start: number; end: number }[]
): Promise<MeetingSummary> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Format transcript with speaker labels and timestamps
  const formattedTranscript = speakers
    .map((segment) => {
      const minutes = Math.floor(segment.start / 60);
      const seconds = Math.floor(segment.start % 60);
      const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      return `[${timestamp}] Speaker ${segment.speaker}: ${segment.text}`;
    })
    .join('\n\n');

  const result = await model.generateContent(
    `Summarise this meeting transcript. Extract:
- Overall summary (2-3 sentences)
- Key discussion points (bullet points)
- Action items with who's responsible (if mentioned)
- Decisions made (if any)

Format your response as JSON with this structure:
{
  "summary": "Overall summary here",
  "keyPoints": ["Point 1", "Point 2", ...],
  "actionItems": ["Action 1", "Action 2", ...],
  "decisions": ["Decision 1", "Decision 2", ...]
}

If no action items or decisions were mentioned, use empty arrays.
Do NOT infer, assume, or speculate. Do NOT fabricate names, dates, or details not in the transcript.

Transcript:

${formattedTranscript}`
  );

  const text = result.response.text();

  // Extract JSON from response (Gemini may wrap it in markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not extract JSON from Gemini response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as MeetingSummary;

  return {
    summary: parsed.summary || '',
    keyPoints: parsed.keyPoints || [],
    actionItems: parsed.actionItems || [],
    decisions: parsed.decisions || [],
  };
}

/**
 * Format meeting summary as human-readable text
 */
export function formatSummary(summary: MeetingSummary): string {
  let formatted = `${summary.summary}\n\n`;

  if (summary.keyPoints.length > 0) {
    formatted += '## Key Points\n\n';
    summary.keyPoints.forEach((point) => {
      formatted += `- ${point}\n`;
    });
    formatted += '\n';
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
      formatted += `- ${item}\n`;
    });
    formatted += '\n';
  }

  return formatted.trim();
}
