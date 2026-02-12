'use client';

import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  CalendarClock,
  Repeat,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverrideFormData {
  date: string;
  startTime: string;
  endTime: string;
  type: 'available' | 'blocked';
  reason: string;
  isRecurring: boolean;
  recurrenceRule: string;
}

const EMPTY_FORM: OverrideFormData = {
  date: '',
  startTime: '09:00',
  endTime: '17:00',
  type: 'blocked',
  reason: '',
  isRecurring: false,
  recurrenceRule: '',
};

// Common recurrence presets for non-technical users
const RECURRENCE_PRESETS = [
  { label: 'Every Monday', value: 'FREQ=WEEKLY;BYDAY=MO' },
  { label: 'Every Tuesday', value: 'FREQ=WEEKLY;BYDAY=TU' },
  { label: 'Every Wednesday', value: 'FREQ=WEEKLY;BYDAY=WE' },
  { label: 'Every Thursday', value: 'FREQ=WEEKLY;BYDAY=TH' },
  { label: 'Every Friday', value: 'FREQ=WEEKLY;BYDAY=FR' },
  { label: 'Every Saturday', value: 'FREQ=WEEKLY;BYDAY=SA' },
  { label: 'Every Sunday', value: 'FREQ=WEEKLY;BYDAY=SU' },
  { label: 'Every weekday (Mon-Fri)', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Every weekend (Sat-Sun)', value: 'FREQ=WEEKLY;BYDAY=SA,SU' },
  { label: 'First Monday of month', value: 'FREQ=MONTHLY;BYDAY=1MO' },
  { label: 'Last Friday of month', value: 'FREQ=MONTHLY;BYDAY=-1FR' },
];

// Human-readable descriptions for known RRULE patterns
function describeRecurrenceRule(rule: string): string {
  const preset = RECURRENCE_PRESETS.find((p) => p.value === rule);
  if (preset) return preset.label;
  return rule; // Fallback to raw RRULE
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverridesEditor() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<OverrideFormData>({ ...EMPTY_FORM });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; reason: string | null } | null>(null);

  const utils = trpc.useUtils();

  const { data: overrides, isLoading } =
    trpc.availability.listOverrides.useQuery();

  const createMutation = trpc.availability.createOverride.useMutation({
    onSuccess: () => {
      utils.availability.listOverrides.invalidate();
      toast.success('Override created');
      closeForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.availability.updateOverride.useMutation({
    onSuccess: () => {
      utils.availability.listOverrides.invalidate();
      toast.success('Override updated');
      closeForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.availability.deleteOverride.useMutation({
    onSuccess: () => {
      utils.availability.listOverrides.invalidate();
      toast.success('Override deleted');
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setDeleteTarget(null);
    },
  });

  // ---------------------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------------------

  function openCreateForm() {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
    setFormOpen(true);
  }

  function openEditForm(override: {
    id: string;
    date: string | null;
    startTime: string;
    endTime: string;
    type: 'available' | 'blocked';
    reason: string | null;
    isRecurring: boolean;
    recurrenceRule: string | null;
  }) {
    setEditingId(override.id);
    setFormData({
      date: override.date || '',
      startTime: override.startTime.slice(0, 5),
      endTime: override.endTime.slice(0, 5),
      type: override.type,
      reason: override.reason || '',
      isRecurring: override.isRecurring,
      recurrenceRule: override.recurrenceRule || '',
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      date: formData.isRecurring ? undefined : formData.date || undefined,
      startTime: formData.startTime,
      endTime: formData.endTime,
      type: formData.type,
      reason: formData.reason || undefined,
      isRecurring: formData.isRecurring,
      recurrenceRule: formData.isRecurring ? formData.recurrenceRule || undefined : undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Availability Overrides</CardTitle>
              <CardDescription>
                Override your regular working hours for specific dates or
                recurring patterns. &ldquo;Available&rdquo; overrides open up
                time outside your working hours. &ldquo;Blocked&rdquo; overrides
                close off time within your working hours.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreateForm}>
              <Plus className="mr-2 size-4" />
              Add override
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {overrides?.length === 0 && (
            <div className="rounded-lg border-2 border-dashed p-6 text-center">
              <CalendarClock className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No overrides configured. Your regular working hours apply.
              </p>
            </div>
          )}

          {overrides && overrides.length > 0 && (
            <div className="space-y-2">
              {overrides.map((override) => (
                <div
                  key={override.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {override.type === 'available' ? (
                      <ShieldCheck className="size-5 shrink-0 text-emerald-600" />
                    ) : (
                      <ShieldOff className="size-5 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            override.type === 'available'
                              ? 'default'
                              : 'destructive'
                          }
                          className="text-xs"
                        >
                          {override.type === 'available'
                            ? 'Available'
                            : 'Blocked'}
                        </Badge>
                        <span className="text-sm font-medium">
                          {override.startTime.slice(0, 5)} &ndash;{' '}
                          {override.endTime.slice(0, 5)}
                        </span>
                        {override.isRecurring && override.recurrenceRule && (
                          <Badge variant="outline" className="text-xs">
                            <Repeat className="mr-1 size-3" />
                            {describeRecurrenceRule(override.recurrenceRule)}
                          </Badge>
                        )}
                        {override.date && (
                          <span className="text-sm text-muted-foreground">
                            {new Date(override.date + 'T00:00:00').toLocaleDateString(
                              'en-GB',
                              {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              },
                            )}
                          </span>
                        )}
                      </div>
                      {override.reason && (
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {override.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      onClick={() => openEditForm(override)}
                      aria-label="Edit override"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      onClick={() =>
                        setDeleteTarget({
                          id: override.id,
                          reason: override.reason,
                        })
                      }
                      aria-label="Delete override"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialogue */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit override' : 'Add override'}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? 'Update this availability override.'
                  : 'Create a new availability override for a specific date or recurring pattern.'}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="override-type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'available' | 'blocked') =>
                    setFormData((prev) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger id="override-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">
                      Available — open up time outside working hours
                    </SelectItem>
                    <SelectItem value="blocked">
                      Blocked — close off time within working hours
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recurring toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  id="override-recurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      isRecurring: checked,
                      date: checked ? '' : prev.date,
                      recurrenceRule: checked ? prev.recurrenceRule : '',
                    }))
                  }
                />
                <Label htmlFor="override-recurring" className="cursor-pointer">
                  Recurring override
                </Label>
              </div>

              {/* Date (non-recurring) or Recurrence rule (recurring) */}
              {formData.isRecurring ? (
                <div className="space-y-2">
                  <Label htmlFor="override-recurrence">Recurrence pattern</Label>
                  <Select
                    value={formData.recurrenceRule}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        recurrenceRule: value,
                      }))
                    }
                  >
                    <SelectTrigger id="override-recurrence">
                      <SelectValue placeholder="Choose a pattern" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="override-date">Date</Label>
                  <Input
                    id="override-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        date: e.target.value,
                      }))
                    }
                    required={!formData.isRecurring}
                  />
                </div>
              )}

              {/* Time range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="override-start">Start time</Label>
                  <Input
                    id="override-start"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startTime: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="override-end">End time</Label>
                  <Input
                    id="override-end"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        endTime: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="override-reason">Reason (optional)</Label>
                <Textarea
                  id="override-reason"
                  placeholder='e.g. "Mosque event but can take calls"'
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? 'Saving...'
                  : editingId
                    ? 'Update override'
                    : 'Create override'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialogue */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete override</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this override
              {deleteTarget?.reason ? ` ("${deleteTarget.reason}")` : ''}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate({ id: deleteTarget.id })
              }
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
