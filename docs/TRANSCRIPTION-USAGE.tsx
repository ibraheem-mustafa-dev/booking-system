/**
 * Example: Upload and transcribe meeting recording
 *
 * This shows how to use the recordings tRPC endpoints in a React component.
 * Adapt this for your dashboard UI.
 */

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

export default function RecordingUploadExample({ bookingId }: { bookingId: string }) {
  const [uploading, setUploading] = useState(false);

  const createRecording = trpc.recordings.create.useMutation({
    onSuccess: (data) => {
      toast.success('Recording transcribed successfully!');
      console.log('Summary:', data.summaryText);
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // Step 1: Get signed upload URL from our server (tiny JSON request)
      const signedRes = await fetch('/api/recordings/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, fileName: file.name }),
      });
      const { storagePath, signedUrl } = await signedRes.json();

      // Step 2: Upload file directly to Supabase Storage (bypasses our server)
      await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'audio/wav' },
        body: file,
      });

      // Step 3: Tell server to transcribe (only sends the path string, not the file)
      await createRecording.mutateAsync({
        bookingId,
        storagePath,
        recordedVia: 'phone_upload',
      });

      setUploading(false);
    } catch (error) {
      console.error(error);
      setUploading(false);
    }
  };

  return (
    <div>
      <label htmlFor="audio-upload" className="cursor-pointer">
        <input
          id="audio-upload"
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => document.getElementById('audio-upload')?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Transcribing...' : 'Upload Recording'}
        </button>
      </label>
    </div>
  );
}

/**
 * Example: List recordings for a booking
 */
export function RecordingsListExample({ bookingId }: { bookingId: string }) {
  const { data: recordings, isLoading } = trpc.recordings.getByBooking.useQuery({
    bookingId,
  });

  if (isLoading) return <p>Loading recordings...</p>;
  if (!recordings?.length) return <p>No recordings yet</p>;

  return (
    <div className="space-y-4">
      {recordings.map((recording) => (
        <div key={recording.id} className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">
            Recorded {new Date(recording.createdAt).toLocaleDateString()} via {recording.recordedVia}
          </p>
          <p className="mt-2 text-sm">
            {recording.transcriptText?.slice(0, 150)}...
          </p>
          {recording.summaryShared && (
            <div className="mt-4 p-3 bg-blue-50 rounded-md">
              <p className="font-medium text-sm">Summary (shared with client)</p>
              <pre className="mt-2 text-xs whitespace-pre-wrap">{recording.summaryText}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Example: View single recording with full transcript
 */
export function RecordingDetailExample({ recordingId }: { recordingId: string }) {
  const { data: recording, isLoading } = trpc.recordings.getById.useQuery({
    id: recordingId,
  });

  const toggleSharing = trpc.recordings.toggleSummarySharing.useMutation({
    onSuccess: () => {
      toast.success('Summary sharing updated');
    },
  });

  if (isLoading) return <p>Loading...</p>;
  if (!recording) return <p>Recording not found</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Meeting Recording</h2>
        <p className="text-sm text-gray-500">
          {new Date(recording.createdAt).toLocaleString()}
        </p>
      </div>

      {/* Summary */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Summary</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={recording.summaryShared}
              onChange={(e) =>
                toggleSharing.mutate({
                  id: recordingId,
                  shared: e.target.checked,
                })
              }
            />
            Share with client
          </label>
        </div>
        <pre className="text-sm whitespace-pre-wrap">{recording.summaryText}</pre>
      </div>

      {/* Full Transcript */}
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-4">Full Transcript</h3>
        <p className="text-sm whitespace-pre-wrap">{recording.transcriptText}</p>
      </div>

      {/* Audio Player */}
      {recording.recordingUrl && (
        <div>
          <h3 className="font-semibold mb-2">Audio</h3>
          <audio controls className="w-full">
            <source src={recording.recordingUrl} />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
    </div>
  );
}
