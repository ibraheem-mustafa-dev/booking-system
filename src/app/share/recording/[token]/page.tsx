import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { meetingRecordings, bookings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const metadata = {
  title: 'Shared Recording',
};

export default async function SharedRecordingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Find recording by share token
  const [result] = await db
    .select({
      recording: meetingRecordings,
      clientName: bookings.clientName,
      startAt: bookings.startAt,
    })
    .from(meetingRecordings)
    .innerJoin(bookings, eq(meetingRecordings.bookingId, bookings.id))
    .where(eq(meetingRecordings.shareToken, token))
    .limit(1);

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Invalid Link</h1>
          <p className="mt-2 text-sm text-gray-500">
            This link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  const { recording, clientName, startAt } = result;

  // Update viewedAt (fire-and-forget)
  void db
    .update(meetingRecordings)
    .set({ viewedAt: new Date() })
    .where(eq(meetingRecordings.id, recording.id))
    .catch(() => {});

  const dateFormatted = startAt.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const summaryJson = recording.summaryJson as {
    summary?: string;
    keyPoints?: { title: string; detail: string }[];
    actionItems?: { text: string; owner?: string }[];
  } | null;

  const transcriptExcerpt = recording.transcriptText
    ? recording.transcriptText.slice(0, 500) + (recording.transcriptText.length > 500 ? '...' : '')
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#0F7E80]">
              <svg className="size-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#0F7E80]">Small Giants Studio</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="space-y-6">
          {/* Meeting info */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meeting Recording</h1>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
              <span>{clientName}</span>
              <span>&middot;</span>
              <span>{dateFormatted}</span>
            </div>
          </div>

          {/* Summary */}
          {(recording.summaryText || summaryJson?.summary) && (
            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Summary</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">
                {recording.summaryText || summaryJson?.summary}
              </p>
            </div>
          )}

          {/* Key points */}
          {summaryJson?.keyPoints && summaryJson.keyPoints.length > 0 && (
            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Key Points</h2>
              <ul className="mt-3 space-y-3">
                {summaryJson.keyPoints.map((point, i) => (
                  <li key={i} className="text-sm">
                    <p className="font-medium text-gray-900">{point.title}</p>
                    <p className="mt-0.5 text-gray-600">{point.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action items */}
          {summaryJson?.actionItems && summaryJson.actionItems.length > 0 && (
            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Action Items</h2>
              <ul className="mt-3 space-y-2">
                {summaryJson.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-gray-300 text-xs text-gray-400">
                      {i + 1}
                    </span>
                    <span className="text-gray-700">
                      {item.text}
                      {item.owner && (
                        <span className="ml-1 text-gray-400">({item.owner})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript excerpt */}
          {transcriptExcerpt && (
            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Transcript</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                {transcriptExcerpt}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <p className="text-center text-xs text-gray-400">
            Powered by Small Giants Studio
          </p>
        </div>
      </footer>
    </div>
  );
}
