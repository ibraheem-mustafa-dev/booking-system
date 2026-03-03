'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Mic,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Mail,
  Calendar,
  Phone,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type UploadState = 'idle' | 'uploading' | 'transcribing' | 'success' | 'error';

export default function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { data: booking, isLoading: loadingBooking } = trpc.bookings.getById.useQuery({ id });

  const {
    data: recordings,
    isLoading: loadingRecordings,
    refetch: refetchRecordings,
  } = trpc.recordings.getByBooking.useQuery(
    { bookingId: id },
    { enabled: !!id }
  );

  const createRecording = trpc.recordings.create.useMutation({
    onSuccess: (data) => {
      setUploadState('success');
      toast.success('Recording transcribed!');
      void refetchRecordings();
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

    if (file.size > 100 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 100MB.');
      return;
    }

    setUploadState('uploading');
    setErrorMessage('');

    try {
      const prepRes = await fetch('/api/recordings/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: id, fileName: file.name, fileSize: file.size }),
      });

      const prepBody = await prepRes.json().catch(() => null);
      if (!prepRes.ok) throw new Error(prepBody?.error || `Upload prep failed (${prepRes.status})`);

      const { storagePath, method } = prepBody;
      const uploadUrl = method === 'supabase' ? prepBody.signedUrl : prepBody.uploadUrl;

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'audio/mpeg' },
        body: file,
      });

      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);

      setUploadState('transcribing');

      await createRecording.mutateAsync({
        bookingId: id,
        storagePath,
        recordedVia: 'phone_upload',
      });
    } catch (error) {
      setUploadState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  if (loadingBooking) {
    return (
      <div className="flex h-screen flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <Skeleton className="h-6 w-48" />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-3xl space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex h-screen flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/bookings')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Bookings
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <p className="text-center text-muted-foreground">Booking not found.</p>
        </main>
      </div>
    );
  }

  const statusVariant =
    booking.status === 'confirmed'
      ? 'default'
      : booking.status === 'cancelled'
        ? 'destructive'
        : 'secondary';

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/bookings')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Bookings
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <h1 className="text-lg font-semibold truncate">{booking.clientName}</h1>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">

          {/* Booking Details */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{booking.clientName}</CardTitle>
                  <CardDescription className="mt-1">
                    Booking #{booking.id.slice(0, 8)}
                  </CardDescription>
                </div>
                <Badge variant={statusVariant} className="capitalize shrink-0">
                  {booking.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Date & Time</dt>
                    <dd className="font-medium">
                      {format(new Date(booking.startAt), 'PPp')}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="font-medium">{booking.clientEmail}</dd>
                  </div>
                </div>
                {booking.clientPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs text-muted-foreground">Phone</dt>
                      <dd className="font-medium">{booking.clientPhone}</dd>
                    </div>
                  </div>
                )}
                {booking.notes && (
                  <div className="sm:col-span-2 text-sm">
                    <dt className="text-xs text-muted-foreground mb-1">Notes</dt>
                    <dd className="text-muted-foreground">{booking.notes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Recordings */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recordings</CardTitle>
                  <CardDescription>
                    Meeting recordings and AI summaries for this booking
                  </CardDescription>
                </div>
                <div>
                  <input
                    id="recording-upload"
                    type="file"
                    accept="audio/*,video/mp4,video/webm"
                    onChange={handleFileUpload}
                    disabled={uploadState === 'transcribing'}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={uploadState === 'transcribing'}
                    onClick={() => document.getElementById('recording-upload')?.click()}
                  >
                    {uploadState === 'transcribing' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Recording
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Upload status */}
              {uploadState === 'uploading' && (
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading file...
                </div>
              )}
              {uploadState === 'transcribing' && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Transcribing and generating summary — ~30-60 seconds...
                    </p>
                  </div>
                </div>
              )}
              {uploadState === 'success' && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    Done! Redirecting to summary...
                  </p>
                </div>
              )}
              {uploadState === 'error' && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
                </div>
              )}

              {/* Recordings list */}
              {loadingRecordings ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : !recordings?.length ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Mic className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No recordings yet</p>
                  <p className="text-xs text-muted-foreground">
                    Upload a meeting recording to generate a transcript and AI summary
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {recordings.map((rec) => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => router.push(`/dashboard/recordings/${rec.id}`)}
                      className="flex w-full items-center gap-4 py-3 text-left hover:bg-muted/50 rounded-lg px-2 transition-colors"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Mic className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {format(new Date(rec.createdAt), 'PPp')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {rec.summaryText ? 'Summary available' : 'Transcript only'}
                          {' · '}
                          {rec.recordedVia.replace('_', ' ')}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
