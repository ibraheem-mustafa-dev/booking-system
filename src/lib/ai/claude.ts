import Anthropic from '@anthropic-ai/sdk';

let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropic;
}

export interface MeetingSummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
}

/**
 * Generate meeting summary from transcript using Claude Haiku
 *
 * Uses Claude 4.5 Haiku for fast, cost-effective summarisation with speaker context
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

  // Format transcript with speaker labels and timestamps
  const formattedTranscript = speakers
    .map((segment) => {
      const minutes = Math.floor(segment.start / 60);
      const seconds = Math.floor(segment.start % 60);
      const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      return `[${timestamp}] Speaker ${segment.speaker}: ${segment.text}`;
    })
    .join('\n\n');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Summarise this meeting transcript. Extract:
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

${formattedTranscript}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude API');
  }

  // Extract JSON from response (Claude may wrap it in markdown code blocks)
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not extract JSON from Claude response');
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
