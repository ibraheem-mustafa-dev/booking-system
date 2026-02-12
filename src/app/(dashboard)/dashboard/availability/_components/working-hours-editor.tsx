'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface DaySchedule {
  enabled: boolean;
  slots: TimeSlot[];
}

type WeekSchedule = Record<number, DaySchedule>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  0: 'Sunday',
};

// Display order: Mon–Sun
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const DEFAULT_SLOT: TimeSlot = { startTime: '09:00', endTime: '17:00' };

const COMMON_TIMEZONES = [
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Zurich',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Lisbon',
  'Europe/Athens',
  'Europe/Helsinki',
  'Europe/Bucharest',
  'Europe/Istanbul',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

// ---------------------------------------------------------------------------
// Helper: convert DB rows to week schedule state
// ---------------------------------------------------------------------------

function dbRowsToSchedule(
  rows: { dayOfWeek: number; startTime: string; endTime: string }[],
): WeekSchedule {
  const schedule: WeekSchedule = {};

  // Initialise all days as disabled with a default slot
  for (const day of DAY_ORDER) {
    schedule[day] = { enabled: false, slots: [{ ...DEFAULT_SLOT }] };
  }

  // Group rows by day
  for (const row of rows) {
    if (!schedule[row.dayOfWeek]) {
      schedule[row.dayOfWeek] = { enabled: true, slots: [] };
    }
    schedule[row.dayOfWeek].enabled = true;
    schedule[row.dayOfWeek].slots.push({
      startTime: row.startTime.slice(0, 5), // DB returns "09:00:00", we need "09:00"
      endTime: row.endTime.slice(0, 5),
    });
  }

  return schedule;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkingHoursEditor() {
  const [schedule, setSchedule] = useState<WeekSchedule>(() => {
    const initial: WeekSchedule = {};
    for (const day of DAY_ORDER) {
      // Default: Mon-Fri enabled 09:00-17:00, Sat-Sun disabled
      const isWeekday = day >= 1 && day <= 5;
      initial[day] = {
        enabled: isWeekday,
        slots: [{ ...DEFAULT_SLOT }],
      };
    }
    return initial;
  });

  const [timezone, setTimezone] = useState('Europe/London');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { data: existingHours, isLoading } =
    trpc.availability.getWorkingHours.useQuery();

  const saveMutation = trpc.availability.saveWorkingHours.useMutation({
    onSuccess: () => {
      toast.success('Working hours saved');
      setHasUnsavedChanges(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Populate form from DB data
  useEffect(() => {
    if (existingHours && existingHours.length > 0) {
      setSchedule(dbRowsToSchedule(existingHours));
      setTimezone(existingHours[0].timezone);
    }
  }, [existingHours]);

  // ---------------------------------------------------------------------------
  // Schedule update helpers
  // ---------------------------------------------------------------------------

  const updateSchedule = useCallback(
    (updater: (prev: WeekSchedule) => WeekSchedule) => {
      setSchedule((prev) => {
        const next = updater(prev);
        setHasUnsavedChanges(true);
        return next;
      });
    },
    [],
  );

  const toggleDay = useCallback(
    (day: number) => {
      updateSchedule((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          enabled: !prev[day].enabled,
          // Reset to default slot when enabling
          slots: !prev[day].enabled
            ? [{ ...DEFAULT_SLOT }]
            : prev[day].slots,
        },
      }));
    },
    [updateSchedule],
  );

  const updateSlot = useCallback(
    (day: number, slotIndex: number, field: 'startTime' | 'endTime', value: string) => {
      updateSchedule((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          slots: prev[day].slots.map((slot, i) =>
            i === slotIndex ? { ...slot, [field]: value } : slot,
          ),
        },
      }));
    },
    [updateSchedule],
  );

  const addSlot = useCallback(
    (day: number) => {
      updateSchedule((prev) => {
        const lastSlot = prev[day].slots[prev[day].slots.length - 1];
        // Start the new slot 1 hour after the last slot ends
        const lastEndHour = parseInt(lastSlot.endTime.split(':')[0], 10);
        const newStart = `${String(Math.min(lastEndHour + 1, 23)).padStart(2, '0')}:00`;
        const newEnd = `${String(Math.min(lastEndHour + 2, 23)).padStart(2, '0')}:00`;

        return {
          ...prev,
          [day]: {
            ...prev[day],
            slots: [...prev[day].slots, { startTime: newStart, endTime: newEnd }],
          },
        };
      });
    },
    [updateSchedule],
  );

  const removeSlot = useCallback(
    (day: number, slotIndex: number) => {
      updateSchedule((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          slots: prev[day].slots.filter((_, i) => i !== slotIndex),
          // If removing the last slot, disable the day
          enabled: prev[day].slots.length > 1,
        },
      }));
    },
    [updateSchedule],
  );

  // ---------------------------------------------------------------------------
  // Save handler
  // ---------------------------------------------------------------------------

  const handleSave = () => {
    const slots: { dayOfWeek: number; startTime: string; endTime: string }[] = [];

    for (const day of DAY_ORDER) {
      if (schedule[day].enabled) {
        for (const slot of schedule[day].slots) {
          slots.push({
            dayOfWeek: day,
            startTime: slot.startTime,
            endTime: slot.endTime,
          });
        }
      }
    }

    saveMutation.mutate({ timezone, slots });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Working Hours</CardTitle>
        <CardDescription>
          Set your regular availability for each day of the week. You can add
          multiple time slots per day for split schedules (e.g. lunch break).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timezone selector */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="timezone-select" className="text-sm font-medium min-w-fit">
            Timezone
          </label>
          <Select
            value={timezone}
            onValueChange={(value) => {
              setTimezone(value);
              setHasUnsavedChanges(true);
            }}
          >
            <SelectTrigger id="timezone-select" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Weekly schedule */}
        <div className="space-y-3">
          {DAY_ORDER.map((day) => {
            const daySchedule = schedule[day];
            return (
              <div
                key={day}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:p-4"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    id={`day-${day}`}
                    checked={daySchedule.enabled}
                    onCheckedChange={() => toggleDay(day)}
                    aria-label={`Toggle ${DAY_LABELS[day]}`}
                  />
                  <label
                    htmlFor={`day-${day}`}
                    className="min-w-[90px] text-sm font-medium cursor-pointer select-none"
                  >
                    {DAY_LABELS[day]}
                  </label>

                  {!daySchedule.enabled && (
                    <span className="text-sm text-muted-foreground">
                      Unavailable
                    </span>
                  )}
                </div>

                {daySchedule.enabled && (
                  <div className="ml-0 space-y-2 sm:ml-[calc(36px+0.75rem)]">
                    {daySchedule.slots.map((slot, slotIndex) => (
                      <div
                        key={slotIndex}
                        className="flex items-center gap-2"
                      >
                        <Input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) =>
                            updateSlot(day, slotIndex, 'startTime', e.target.value)
                          }
                          className="w-32"
                          aria-label={`${DAY_LABELS[day]} slot ${slotIndex + 1} start time`}
                        />
                        <span className="text-sm text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) =>
                            updateSlot(day, slotIndex, 'endTime', e.target.value)
                          }
                          className="w-32"
                          aria-label={`${DAY_LABELS[day]} slot ${slotIndex + 1} end time`}
                        />
                        {daySchedule.slots.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-9 shrink-0"
                            onClick={() => removeSlot(day, slotIndex)}
                            aria-label={`Remove ${DAY_LABELS[day]} time slot ${slotIndex + 1}`}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      onClick={() => addSlot(day)}
                    >
                      <Plus className="mr-1 size-4" />
                      Add time slot
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !hasUnsavedChanges}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save working hours'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
