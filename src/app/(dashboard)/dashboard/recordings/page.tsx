'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Mic,
  FileAudio,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type UploadState = 'idle' | 'uploading' | 'transcribing' | 'success' | 'error';

export default function RecordingsPage() {
  const router = useRouter();
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Fetch recent bookings for dropdown
  const { data: bookings, isLoading: loadingBookings } =
    trpc.bookings.list.useQuery(
      { limit: 50 },
      { enabled: true }
    );

  const createRecording = trpc.recordings.create.useMutation({
    onSuccess: (data) => {
      setUploadState('success');
      toast.success('Recording transcribed successfully!');
      console.log('Summary:', data.summaryText);

      // Redirect to recording detail (we'll build this next)
      setTimeout(() => {
        router.push(`/dashboard/recordings/${data.id}`);
      }, 1500);
    },
    onError: (error) => {
      setUploadState('error');
      setErrorMessage(error.message);
      toast.error(`Transcription failed: ${error.message}`);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedBookingId) {
      toast.error('Please select a booking first');
      return;
    }

    // Check file size (max 100MB for MVP)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 100MB.');
      return;
    }

    // Check file type
    const allowedTypes = [
      'audio/wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/x-m4a',
      'audio/flac',
      'audio/ogg',
      'audio/webm',
      'video/mp4', // Some recorders save as mp4
      'video/webm',
    ];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|m4a|flac|ogg|webm|mp4)$/i)) {
      toast.error('Unsupported file type. Please upload WAV, MP3, M4A, FLAC, OGG, or WEBM.');
      return;
    }

    setUploadState('uploading');
    setErrorMessage('');

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = async () => {
        const base64Data = reader.result as string;
        // Remove data URL prefix (e.g., "data:audio/wav;base64,")
        const base64Audio = base64Data.split(',')[1];

        setUploadState('transcribing');

        await createRecording.mutateAsync({
          bookingId: selectedBookingId,
          audioFile: {
            name: file.name,
            type: file.type || 'audio/wav',
            size: file.size,
            data: base64Audio,
          },
          recordedVia: 'phone_upload',
        });
      };

      reader.onerror = () => {
        setUploadState('error');
        setErrorMessage('Failed to read file');
        toast.error('Failed to read file');
      };
    } catch (error) {
      console.error(error);
      setUploadState('error');
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-6" />
        <h1 className="text-lg font-semibold">Meeting Recordings</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Recording</CardTitle>
              <CardDescription>
                Upload a meeting recording to generate transcript and AI summary
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Booking Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Booking</label>
                <Select
                  value={selectedBookingId}
                  onValueChange={setSelectedBookingId}
                  disabled={loadingBookings || uploadState === 'transcribing'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a booking..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bookings?.map((booking) => (
                      <SelectItem key={booking.id} value={booking.id}>
                        {booking.clientName} — {new Date(booking.startTime).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loadingBookings && bookings?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No bookings found. Create a booking first.
                  </p>
                )}
              </div>

              {/* Upload Button */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    id="audio-upload"
                    type="file"
                    accept="audio/*,video/mp4,video/webm"
                    onChange={handleFileUpload}
                    disabled={!selectedBookingId || uploadState === 'transcribing'}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    onClick={() => document.getElementById('audio-upload')?.click()}
                    disabled={!selectedBookingId || uploadState === 'transcribing'}
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    {uploadState === 'transcribing' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Transcribing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Choose Audio File
                      </>
                    )}
                  </Button>
                </div>

                {/* Status Messages */}
                {uploadState === 'uploading' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading file...
                  </div>
                )}

                {uploadState === 'transcribing' && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                    <div className="flex items-start gap-3">
                      <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                      <div className="space-y-1">
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          Processing recording...
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          This may take 30-60 seconds. We're transcribing with speaker
                          identification and generating an AI summary.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {uploadState === 'success' && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
                      <div className="space-y-1">
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Transcription complete!
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Redirecting to view results...
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {uploadState === 'error' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
                    <div className="flex items-start gap-3">
                      <XCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
                      <div className="space-y-1">
                        <p className="font-medium text-red-900 dark:text-red-100">
                          Transcription failed
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          {errorMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Supported Formats */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="mb-2 text-sm font-medium">Supported Formats</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">WAV</Badge>
                  <Badge variant="secondary">MP3</Badge>
                  <Badge variant="secondary">M4A</Badge>
                  <Badge variant="secondary">FLAC</Badge>
                  <Badge variant="secondary">OGG</Badge>
                  <Badge variant="secondary">WEBM</Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Maximum file size: 100MB. Transcription takes ~30-60 seconds per
                  hour of audio.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <FileAudio className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-medium">1. Upload Audio</h3>
                  <p className="text-sm text-muted-foreground">
                    Select a booking and upload your meeting recording
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-medium">2. AI Processing</h3>
                  <p className="text-sm text-muted-foreground">
                    Deepgram transcribes with speaker ID, Claude generates summary
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-medium">3. View Results</h3>
                  <p className="text-sm text-muted-foreground">
                    See transcript, speaker turns, key points, and action items
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
