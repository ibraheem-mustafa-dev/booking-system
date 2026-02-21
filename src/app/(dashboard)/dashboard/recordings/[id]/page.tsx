'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Share2,
  Trash2,
  FileAudio,
  Users,
  Calendar,
  Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function RecordingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const { data: recording, isLoading } = trpc.recordings.getById.useQuery({ id });

  const toggleSharing = trpc.recordings.toggleSummarySharing.useMutation({
    onSuccess: () => {
      toast.success('Summary sharing updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteRecording = trpc.recordings.delete.useMutation({
    onSuccess: () => {
      toast.success('Recording deleted');
      router.push('/dashboard/recordings');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const utils = trpc.useUtils();

  const handleToggleSharing = async (shared: boolean) => {
    await toggleSharing.mutateAsync({ id, shared });
    // Optimistically update
    utils.recordings.getById.setData({ id }, (old) => {
      if (!old) return old;
      return { ...old, summaryShared: shared };
    });
  };

  const handleDelete = async () => {
    await deleteRecording.mutateAsync({ id });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <Skeleton className="h-6 w-48" />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!recording) {
    return (
      <div className="flex h-screen flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-lg font-semibold">Recording Not Found</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  This recording could not be found.
                </p>
                <div className="mt-4 flex justify-center">
                  <Button onClick={() => router.push('/dashboard/recordings')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Recordings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/recordings')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Recordings
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <h1 className="text-lg font-semibold">Meeting Recording</h1>

        <div className="ml-auto flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Recording?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the recording, transcript, and summary.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteRecording.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle>Recording Details</CardTitle>
                  <CardDescription>
                    Recorded {new Date(recording.createdAt).toLocaleString('en-GB')}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {recording.recordedVia.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {recording.recordingUrl && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Audio Playback</label>
                  <audio controls className="w-full">
                    <source src={recording.recordingUrl} />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI Summary</CardTitle>
                  <CardDescription>
                    Generated by Gemini 2.5 Flash
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="share-summary" className="text-sm font-medium">
                    Share with client
                  </label>
                  <Switch
                    id="share-summary"
                    checked={recording.summaryShared}
                    onCheckedChange={handleToggleSharing}
                    disabled={toggleSharing.isPending}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recording.summaryText ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {recording.summaryText}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No summary available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Full Transcript */}
          <Card>
            <CardHeader>
              <CardTitle>Full Transcript</CardTitle>
              <CardDescription>
                Transcribed by Deepgram Nova-3 with speaker diarization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recording.transcriptText ? (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {recording.transcriptText}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No transcript available
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
