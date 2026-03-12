'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BookingInfo {
  clientName: string;
  bookingTypeName: string;
  bookingTypeSlug: string;
  durationMins: number;
  maxAdvanceDays: number;
  startAt: string;
  endAt: string;
  timezone: string;
  orgSlug: string;
}

interface TimeSlot {
  start: string;
  end: string;
}

type Step = 'date' | 'time' | 'confirm' | 'done';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(isoString: string, tz: string): string {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  });
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RescheduleBookingPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('date');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const timezone = typeof window !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'Europe/London';

  // Load booking info
  useEffect(() => {
    if (!token) {
      setError('No reschedule token provided.');
      setLoading(false);
      return;
    }

    fetch(`/api/v1/booking/lookup?token=${encodeURIComponent(token)}&type=reschedule`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setBookingInfo(data);
        }
      })
      .catch(() => setError('Failed to load booking details.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Fetch available slots when date changes
  useEffect(() => {
    if (!selectedDate || !bookingInfo) return;

    setSlotsLoading(true);
    setSlots([]);

    const dateStr = formatDateStr(selectedDate);
    const url = `/api/v1/book/${bookingInfo.orgSlug}/${bookingInfo.bookingTypeSlug}/availability?date=${dateStr}&timezone=${encodeURIComponent(timezone)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSlots(data.slots || []);
        }
      })
      .catch(() => setError('Failed to load availability.'))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, bookingInfo, timezone]);

  // Submit reschedule
  async function handleConfirm() {
    if (!token || !selectedSlot) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/booking/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          startAt: selectedSlot.start,
          timezone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reschedule booking.');
        return;
      }

      setStep('done');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Calendar nav
  const maxDate = bookingInfo
    ? new Date(today.getTime() + bookingInfo.maxAdvanceDays * 86400000)
    : new Date(today.getTime() + 60 * 86400000);

  function prevMonth() {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear((y) => y - 1); }
    else setCalendarMonth((m) => m - 1);
  }

  function nextMonth() {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear((y) => y + 1); }
    else setCalendarMonth((m) => m + 1);
  }

  const canGoPrev = calendarYear > today.getFullYear() || (calendarYear === today.getFullYear() && calendarMonth > today.getMonth());
  const canGoNext = calendarYear < maxDate.getFullYear() || (calendarYear === maxDate.getFullYear() && calendarMonth < maxDate.getMonth());
  const calendarDays = getCalendarDays(calendarYear, calendarMonth);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          <p className="mt-4 text-sm text-gray-500">Loading booking details...</p>
        </div>
      </div>
    );
  }

  // Error state (no booking loaded)
  if (error && !bookingInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Unable to Reschedule</h1>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!bookingInfo) return null;

  // Current booking summary
  const currentStart = new Date(bookingInfo.startAt);
  const currentDateFormatted = currentStart.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: bookingInfo.timezone,
  });
  const currentTimeFormatted = currentStart.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: bookingInfo.timezone,
  });

  // Done state
  if (step === 'done') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100">
            <svg className="size-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Booking Rescheduled</h1>
          <p className="mt-2 text-sm text-gray-500">
            Your booking has been moved. An updated confirmation email has been sent.
          </p>
          {selectedSlot && selectedDate && (
            <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm">
              <p className="font-semibold text-gray-900">{bookingInfo.bookingTypeName}</p>
              <p className="mt-1 text-gray-600">
                {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-gray-600">
                {formatTime(selectedSlot.start, timezone)} ({timezone})
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Reschedule Booking</h1>

        {/* Current booking info */}
        <div className="mt-4 rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Current booking</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{bookingInfo.bookingTypeName}</p>
          <p className="text-sm text-gray-600">{currentDateFormatted}</p>
          <p className="text-sm text-gray-600">{currentTimeFormatted} ({bookingInfo.timezone})</p>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step: Date picker */}
        {step === 'date' && (
          <div className="mt-6">
            <p className="mb-3 text-sm font-medium text-gray-700">Choose a new date:</p>

            {/* Month nav */}
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={prevMonth} disabled={!canGoPrev} className="flex size-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 disabled:opacity-30" aria-label="Previous month">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
              </button>
              <span className="text-sm font-semibold">{MONTH_NAMES[calendarMonth]} {calendarYear}</span>
              <button type="button" onClick={nextMonth} disabled={!canGoNext} className="flex size-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 disabled:opacity-30" aria-label="Next month">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-gray-400">
              {DAY_LABELS.map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />;
                const isPast = day < today;
                const isBeyondMax = day > maxDate;
                const isDisabled = isPast || isBeyondMax;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, today);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => { setSelectedDate(day); setSelectedSlot(null); setStep('time'); setError(null); }}
                    className={`flex size-10 items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:opacity-30 ${isSelected ? 'bg-gray-900 text-white' : isToday ? 'ring-2 ring-gray-900' : 'hover:bg-gray-100'}`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step: Time picker */}
        {step === 'time' && selectedDate && (
          <div className="mt-6">
            <button type="button" onClick={() => { setStep('date'); setError(null); }} className="mb-3 text-sm font-medium text-gray-500 hover:text-gray-700">
              &larr; Change date
            </button>

            <p className="mb-1 text-sm font-semibold text-gray-900">
              {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="mb-4 text-xs text-gray-500">{bookingInfo.durationMins} minutes &middot; {timezone}</p>

            {slotsLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="size-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              </div>
            )}

            {!slotsLoading && slots.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-500">No available times on this date.</p>
            )}

            {!slotsLoading && slots.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    onClick={() => { setSelectedSlot(slot); setStep('confirm'); setError(null); }}
                    className={`flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${selectedSlot?.start === slot.start ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}
                  >
                    {formatTime(slot.start, timezone)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && selectedSlot && selectedDate && (
          <div className="mt-6">
            <button type="button" onClick={() => { setStep('time'); setError(null); }} className="mb-3 text-sm font-medium text-gray-500 hover:text-gray-700">
              &larr; Change time
            </button>

            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600">New time</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm text-gray-600">
                {formatTime(selectedSlot.start, timezone)} ({timezone})
              </p>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-gray-900 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
            >
              {submitting ? 'Rescheduling...' : 'Confirm reschedule'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
