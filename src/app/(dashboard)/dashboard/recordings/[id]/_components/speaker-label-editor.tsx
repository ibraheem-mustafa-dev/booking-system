'use client';

import { useState, useMemo } from 'react';
import { Users, ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SpeakerLabelEditorProps {
  recordingId: string;
  transcriptText: string;
  speakerLabels: Record<string, string>;
  onLabelsUpdated: (labels: Record<string, string>) => void;
}

export function SpeakerLabelEditor({
  recordingId,
  transcriptText,
  speakerLabels,
  onLabelsUpdated,
}: SpeakerLabelEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>(speakerLabels);

  // Extract unique speaker numbers from transcript
  const speakerNumbers = useMemo(() => {
    const matches = transcriptText.match(/Speaker (\d+)/g) || [];
    const numbers = new Set(matches.map((m) => m.replace('Speaker ', '')));
    return Array.from(numbers).sort((a, b) => Number(a) - Number(b));
  }, [transcriptText]);

  const updateLabels = trpc.recordings.updateSpeakerLabels.useMutation({
    onSuccess: () => {
      toast.success('Speaker names updated');
      onLabelsUpdated(labels);
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleSave = () => {
    // Only include non-empty labels
    const cleanLabels: Record<string, string> = {};
    for (const [key, value] of Object.entries(labels)) {
      if (value.trim()) {
        cleanLabels[key] = value.trim();
      }
    }
    updateLabels.mutate({ id: recordingId, speakerLabels: cleanLabels });
  };

  if (speakerNumbers.length < 2) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">
              Speaker Names
              {Object.values(speakerLabels).some((v) => v.trim()) && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({Object.values(speakerLabels).filter((v) => v.trim()).length} named)
                </span>
              )}
            </CardTitle>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Name each speaker to replace &quot;Speaker 0&quot;, &quot;Speaker 1&quot;, etc. throughout the summary and transcript.
          </p>
          {speakerNumbers.map((num) => (
            <div key={num} className="flex items-center gap-3">
              <label
                htmlFor={`speaker-${num}`}
                className="w-24 shrink-0 text-sm text-muted-foreground"
              >
                Speaker {num}
              </label>
              <Input
                id={`speaker-${num}`}
                value={labels[num] || ''}
                onChange={(e) =>
                  setLabels((prev) => ({ ...prev, [num]: e.target.value }))
                }
                placeholder="Enter name..."
                className="h-9"
              />
            </div>
          ))}
          <Button
            onClick={handleSave}
            disabled={updateLabels.isPending}
            size="sm"
            className="mt-2"
          >
            {updateLabels.isPending ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-3.5 w-3.5" />
                Save Names
              </>
            )}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
