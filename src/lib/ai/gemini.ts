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
  keyPoints: { title: string; detail: string }[];
  actionItems: { text: string; owner?: string }[];
  decisions: string[];
  memorableFacts: {
    quotes: string[];
    stats: string[];
    names: string[];
    dates: string[];
  };
  mentionedUrls: { url: string; context: string }[];
}

/**
 * Generate meeting summary from transcript using Gemini 2.5 Flash
 *
 * Returns structured JSON with key points, facts, URLs, action items,
 * and decisions extracted from the transcript.
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
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

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
    `You are a meeting analyst. Analyse this transcript and extract structured data.

RULES:
- Do NOT infer, assume, or speculate
- Do NOT fabricate names, dates, or details not in the transcript
- Use UK English spelling (summarise, organise, colour, etc.)
- If a section has no content, use empty arrays
- For keyPoints, each must have a short title (3-6 words) and a detail paragraph (2-3 sentences explaining the discussion, referencing which speaker said what)
- For actionItems, include who is responsible if mentioned (use "Speaker N" if no name given)
- For memorableFacts, extract ONLY items explicitly stated in the transcript:
  - quotes: Notable or impactful phrases said verbatim (wrap in quotation marks)
  - stats: Numbers, percentages, monetary amounts, quantities
  - names: People, companies, products, titles mentioned
  - dates: Specific dates, deadlines, timeframes mentioned
- For mentionedUrls: Extract any website URLs, domain names, or web references mentioned. Include the context of why it was mentioned

Format your response as JSON:
{
  "summary": "2-3 sentence overview",
  "keyPoints": [{ "title": "Short title", "detail": "2-3 sentences about the discussion" }],
  "actionItems": [{ "text": "Action description", "owner": "Speaker N or name" }],
  "decisions": ["Decision 1"],
  "memorableFacts": {
    "quotes": ["\\"We need to move fast\\""],
    "stats": ["£45,000 budget", "85% completion"],
    "names": ["Sarah from Finance", "Acme Corp"],
    "dates": ["15 March deadline", "Q3 2026"]
  },
  "mentionedUrls": [{ "url": "example.com/proposal", "context": "Shared as reference for pricing" }]
}

Transcript:

${formattedTranscript}`
  );

  const text = result.response.text();

  // With responseMimeType: 'application/json', Gemini returns valid JSON directly.
  // Fall back to regex extraction if it wraps in markdown code blocks.
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Gemini response');
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  // Defensive parsing — handles both new structured format and old flat format
  return {
    summary: parsed.summary || '',
    keyPoints: Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.map((kp: { title?: string; detail?: string } | string) =>
          typeof kp === 'string'
            ? { title: kp, detail: '' }
            : { title: kp.title || '', detail: kp.detail || '' }
        )
      : [],
    actionItems: Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map((ai: { text?: string; owner?: string } | string) =>
          typeof ai === 'string' ? { text: ai } : { text: ai.text || '', owner: ai.owner }
        )
      : [],
    decisions: parsed.decisions || [],
    memorableFacts: {
      quotes: parsed.memorableFacts?.quotes || [],
      stats: parsed.memorableFacts?.stats || [],
      names: parsed.memorableFacts?.names || [],
      dates: parsed.memorableFacts?.dates || [],
    },
    mentionedUrls: Array.isArray(parsed.mentionedUrls)
      ? parsed.mentionedUrls.map((u: { url?: string; context?: string } | string) =>
          typeof u === 'string'
            ? { url: u, context: '' }
            : { url: u.url || '', context: u.context || '' }
        )
      : [],
  };
}

/**
 * Format meeting summary as human-readable markdown text
 *
 * Used for the summaryText column (backwards compat, email sharing, copy-paste)
 */
export function formatSummary(summary: MeetingSummary): string {
  let formatted = `${summary.summary}\n\n`;

  if (summary.keyPoints.length > 0) {
    formatted += '## Key Points\n\n';
    summary.keyPoints.forEach((point) => {
      formatted += `### ${point.title}\n${point.detail}\n\n`;
    });
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
      const owner = item.owner ? ` (${item.owner})` : '';
      formatted += `- ${item.text}${owner}\n`;
    });
    formatted += '\n';
  }

  const facts = summary.memorableFacts;
  const hasAnyFacts =
    facts.quotes.length + facts.stats.length + facts.names.length + facts.dates.length > 0;
  if (hasAnyFacts) {
    formatted += '## Facts & Phrases\n\n';
    if (facts.quotes.length > 0)
      formatted += facts.quotes.map((q) => `- ${q}`).join('\n') + '\n';
    if (facts.stats.length > 0)
      formatted += facts.stats.map((s) => `- ${s}`).join('\n') + '\n';
    if (facts.names.length > 0)
      formatted += facts.names.map((n) => `- ${n}`).join('\n') + '\n';
    if (facts.dates.length > 0)
      formatted += facts.dates.map((d) => `- ${d}`).join('\n') + '\n';
    formatted += '\n';
  }

  if (summary.mentionedUrls.length > 0) {
    formatted += '## Mentioned URLs\n\n';
    summary.mentionedUrls.forEach((u) => {
      formatted += `- ${u.url}${u.context ? ` — ${u.context}` : ''}\n`;
    });
    formatted += '\n';
  }

  return formatted.trim();
}
