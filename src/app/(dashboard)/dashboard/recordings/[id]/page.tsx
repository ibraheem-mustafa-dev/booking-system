'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Copy,
  Check,
  ChevronDown,
  FileText,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { MeetingSummaryView } from './_components/meeting-summary-view';
import { SpeakerLabelEditor } from './_components/speaker-label-editor';
import { formatSummary, type MeetingSummary } from '@/lib/ai/gemini';

export default function RecordingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

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
    utils.recordings.getById.setData({ id }, (old) => {
      if (!old) return old;
      return { ...old, summaryShared: shared };
    });
  };

  const handleLabelsUpdated = (labels: Record<string, string>) => {
    utils.recordings.getById.setData({ id }, (old) => {
      if (!old) return old;
      return { ...old, speakerLabels: labels };
    });
  };

  const handleCopyFullSummary = async () => {
    const summaryJson = recording?.summaryJson as MeetingSummary | null;
    const text = summaryJson
      ? formatSummary(summaryJson)
      : recording?.summaryText || '';
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      toast.success('Full summary copied');
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
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
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
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

  const summaryJson = recording.summaryJson as MeetingSummary | null;
  const speakerLabels = (recording.speakerLabels ?? {}) as Record<string, string>;
  const hasSummary = !!summaryJson || !!recording.summaryText;

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
        <div className="mx-auto max-w-4xl space-y-4">
          {/* Metadata + Audio */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle>Recording Details</CardTitle>
                  <CardDescription>
                    Recorded {new Date(recording.createdAt).toLocaleString('en-GB')}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="capitalize">
                    {recording.recordedVia.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recording.recordingUrl && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Audio Playback</label>
                    <audio controls className="w-full">
                      <source src={recording.recordingUrl} />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
                {/* Share + Copy controls */}
                {hasSummary && (
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="flex items-center gap-2">
                      <label htmlFor="share-summary" className="text-sm font-medium">
                        Share summary with client
                      </label>
                      <Switch
                        id="share-summary"
                        checked={recording.summaryShared}
                        onCheckedChange={handleToggleSharing}
                        disabled={toggleSharing.isPending}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyFullSummary}
                    >
                      {copiedSummary ? (
                        <>
                          <Check className="mr-2 h-3.5 w-3.5 text-green-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Copy Full Summary
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Speaker Label Editor */}
          {recording.transcriptText && (
            <SpeakerLabelEditor
              recordingId={id}
              transcriptText={recording.transcriptText}
              speakerLabels={speakerLabels}
              onLabelsUpdated={handleLabelsUpdated}
            />
          )}

          {/* AI Summary — structured or markdown fallback */}
          {summaryJson ? (
            <MeetingSummaryView
              summary={summaryJson}
              speakerLabels={speakerLabels}
            />
          ) : recording.summaryText ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Summary</CardTitle>
                <CardDescription>Generated by Gemini 2.5 Flash</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {recording.summaryText}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Full Transcript — collapsible */}
          {recording.transcriptText && (
            <Collapsible open={transcriptOpen} onOpenChange={setTranscriptOpen}>
              <Card>
                <CardHeader>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center justify-between text-left">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          Full Transcript
                        </CardTitle>
                        <CardDescription>
                          Transcribed by Deepgram Nova-3 with speaker diarisation
                        </CardDescription>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                          transcriptOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {recording.transcriptText}
                      </p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>
      </main>
    </div>
  );
}
