'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Check } from 'lucide-react';

function LoadingDots() {
  return (
    <span className="loading-dots" aria-label="Loading">
      <span /><span /><span />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface BookingFlowProps {
  orgSlug: string;
  typeSlug: string;
  bookingType: {
    id: string;
    name: string;
    durationMins: number;
    customFields: { fields: CustomField[] };
    maxAdvanceDays: number;
    requiresPayment: boolean;
    priceAmount: string | null;
    priceCurrency: string | null;
  };
}

interface TimeSlot {
  start: string;
  end: string;
}

interface BookingResult {
  id: string;
  startAt: string;
  endAt: string;
}

type Step = 'date' | 'time' | 'form' | 'confirmed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(isoString: string, timezone: string): string {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday = 0, Sunday = 6 (ISO week)
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: (Date | null)[] = [];

  // Padding before first day
  for (let i = 0; i < startDow; i++) {
    days.push(null);
  }

  // Actual days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BookingFlow({ orgSlug, typeSlug, bookingType }: BookingFlowProps) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + bookingType.maxAdvanceDays);

  // State
  const [step, setStep] = useState<Step>('date');
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | boolean | string[]>>({});

  // Fetch available slots when date changes
  useEffect(() => {
    if (!selectedDate) return;

    setSlotsLoading(true);
    setSlots([]);
    setError(null);

    const dateStr = formatDate(selectedDate);
    const url = `/api/v1/book/${orgSlug}/${typeSlug}/availability?date=${dateStr}&timezone=${encodeURIComponent(timezone)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSlots(data.slots || []);
        }
      })
      .catch(() => setError('Failed to load availability. Please try again.'))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, orgSlug, typeSlug, timezone]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleDateSelect(date: Date) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep('time');
  }

  function handleSlotSelect(slot: TimeSlot) {
    setSelectedSlot(slot);
    setStep('form');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/book/${orgSlug}/${typeSlug}/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName,
            clientEmail,
            clientPhone: clientPhone || undefined,
            clientTimezone: timezone,
            startAt: selectedSlot.start,
            notes: notes || undefined,
            customFieldResponses:
              Object.keys(customFieldValues).length > 0
                ? customFieldValues
                : undefined,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setBooking(data);
      setStep('confirmed');
    } catch {
      setError('Failed to create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function goBack() {
    if (step === 'time') {
      setStep('date');
      setSelectedSlot(null);
    } else if (step === 'form') {
      setStep('time');
    }
  }

  // ---------------------------------------------------------------------------
  // Calendar navigation
  // ---------------------------------------------------------------------------

  function prevMonth() {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  }

  const canGoPrev =
    calendarYear > today.getFullYear() ||
    (calendarYear === today.getFullYear() && calendarMonth > today.getMonth());

  const canGoNext =
    calendarYear < maxDate.getFullYear() ||
    (calendarYear === maxDate.getFullYear() && calendarMonth < maxDate.getMonth());

  const calendarDays = getCalendarDays(calendarYear, calendarMonth);

  // ---------------------------------------------------------------------------
  // Render: Date picker
  // ---------------------------------------------------------------------------

  if (step === 'date') {
    return (
      <div
        className="rounded-xl border p-4 sm:p-6"
        style={{
          borderColor: 'var(--brand-primary)',
          borderWidth: '1px',
          borderRadius: 'var(--brand-radius)',
        }}
      >
        {/* Month navigation */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="flex size-11 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
            style={{ backgroundColor: canGoPrev ? 'var(--brand-primary)' : undefined, color: canGoPrev ? '#fff' : undefined }}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="text-base font-semibold">
            {MONTH_NAMES[calendarMonth]} {calendarYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            disabled={!canGoNext}
            className="flex size-11 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
            style={{ backgroundColor: canGoNext ? 'var(--brand-primary)' : undefined, color: canGoNext ? '#fff' : undefined }}
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium opacity-50">
          {DAY_LABELS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} />;
            }

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
                onClick={() => handleDateSelect(day)}
                className="flex size-11 items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
                style={
                  isSelected
                    ? {
                        backgroundColor: 'var(--brand-primary)',
                        color: '#fff',
                      }
                    : isToday
                      ? {
                          border: '2px solid var(--brand-primary)',
                        }
                      : undefined
                }
                aria-label={day.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs opacity-50">
          Timezone: {timezone}
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Time slot selection
  // ---------------------------------------------------------------------------

  if (step === 'time') {
    return (
      <div
        className="rounded-xl border p-4 sm:p-6"
        style={{
          borderColor: 'var(--brand-primary)',
          borderWidth: '1px',
          borderRadius: 'var(--brand-radius)',
        }}
      >
        <button
          type="button"
          onClick={goBack}
          className="mb-4 flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--brand-primary)' }}
        >
          <ChevronLeft className="size-4" />
          Change date
        </button>

        <h3 className="mb-1 text-base font-semibold">
          {selectedDate?.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </h3>
        <p className="mb-4 text-sm opacity-60">
          <Clock className="mr-1 inline size-3.5" />
          {bookingType.durationMins} minutes &middot; {timezone}
        </p>

        {slotsLoading && (
          <div className="flex items-center justify-center py-12">
            <LoadingDots />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!slotsLoading && !error && slots.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm opacity-60">
              No available times on this date. Please choose another day.
            </p>
          </div>
        )}

        {!slotsLoading && slots.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => {
              const isSelected =
                selectedSlot && selectedSlot.start === slot.start;

              return (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => handleSlotSelect(slot)}
                  className="flex h-11 items-center justify-center rounded-full border px-4 font-mono text-sm font-medium transition-all duration-200 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] hover:translate-x-0.5 active:scale-95"
                  style={
                    isSelected
                      ? {
                          backgroundColor: 'var(--brand-primary)',
                          color: '#fff',
                          borderColor: 'var(--brand-primary)',
                        }
                      : {
                          borderColor: 'var(--brand-primary)',
                          color: 'var(--brand-primary)',
                          backgroundColor: 'transparent',
                        }
                  }
                >
                  {formatTime(slot.start, timezone)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Booking form
  // ---------------------------------------------------------------------------

  if (step === 'form') {
    const customFields = bookingType.customFields?.fields || [];

    return (
      <div
        className="rounded-xl border p-4 sm:p-6"
        style={{
          borderColor: 'var(--brand-primary)',
          borderWidth: '1px',
          borderRadius: 'var(--brand-radius)',
        }}
      >
        <button
          type="button"
          onClick={goBack}
          className="mb-4 flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--brand-primary)' }}
        >
          <ChevronLeft className="size-4" />
          Change time
        </button>

        {/* Selected slot summary */}
        <div
          className="mb-6 rounded-lg p-3"
          style={{ backgroundColor: 'var(--brand-primary)', color: '#fff' }}
        >
          <p className="text-sm font-semibold">
            {selectedDate?.toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <p className="text-sm opacity-90">
            {selectedSlot && formatTime(selectedSlot.start, timezone)} &ndash;{' '}
            {selectedSlot && formatTime(selectedSlot.end, timezone)} &middot;{' '}
            {bookingType.durationMins} min
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <FloatingInput
            id="client-name"
            label="Name *"
            type="text"
            required
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />

          {/* Email */}
          <FloatingInput
            id="client-email"
            label="Email *"
            type="email"
            required
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
          />

          {/* Phone */}
          <FloatingInput
            id="client-phone"
            label="Phone"
            type="tel"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
          />

          {/* Custom fields */}
          {customFields.map((field) => (
            <CustomFieldInput
              key={field.id}
              field={field}
              value={customFieldValues[field.id]}
              onChange={(value) =>
                setCustomFieldValues((prev) => ({
                  ...prev,
                  [field.id]: value,
                }))
              }
            />
          ))}

          {/* Notes */}
          <div className="relative">
            <textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder=" "
              className="peer w-full resize-none border-0 border-b bg-transparent pb-1 pt-5 text-sm focus:outline-none"
              style={{ borderColor: 'var(--brand-primary)' }}
            />
            <label
              htmlFor="client-notes"
              className="pointer-events-none absolute left-0 top-0 text-xs font-medium transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-0 peer-focus:text-xs"
              style={{ color: 'var(--brand-primary)' }}
            >
              Notes
            </label>
          </div>

          {/* Payment notice */}
          {bookingType.requiresPayment && bookingType.priceAmount && (
            <div className="rounded-lg border p-3 text-sm">
              <strong>Payment:</strong> {bookingType.priceCurrency}{' '}
              {bookingType.priceAmount} — payment will be collected separately.
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{
              backgroundColor: 'var(--brand-primary)',
              color: '#fff',
              borderRadius: 'var(--brand-radius)',
            }}
          >
            {submitting ? (
              <LoadingDots />
            ) : (
              'Confirm booking'
            )}
          </button>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Confirmation
  // ---------------------------------------------------------------------------

  if (step === 'confirmed' && booking) {
    return (
      <div
        className="rounded-xl border p-6 text-center sm:p-8"
        style={{
          borderColor: 'var(--brand-primary)',
          borderWidth: '1px',
          borderRadius: 'var(--brand-radius)',
        }}
      >
        <div
          className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full animate-spring-in"
          style={{ backgroundColor: '#0F7E80' }}
        >
          <Check className="size-8 text-white" strokeWidth={2.5} />
        </div>

        <h3 className="text-xl font-bold">You&rsquo;re booked in</h3>
        <p className="mt-2 text-sm opacity-70">
          Confirmation sent to <strong>{clientEmail}</strong>.
        </p>

        <div className="mt-6 space-y-1 text-sm">
          <p className="font-medium">{bookingType.name}</p>
          <p>
            {selectedDate?.toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p>
            {formatTime(booking.startAt, timezone)} &ndash;{' '}
            {formatTime(booking.endAt, timezone)}
          </p>
          <p className="opacity-60">{timezone}</p>
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Floating label input — bottom-border only, label animates up on focus/value
// ---------------------------------------------------------------------------

function FloatingInput({
  id,
  label,
  type = 'text',
  required,
  value,
  onChange,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        placeholder=" "
        className="peer h-11 w-full border-0 border-b bg-transparent pb-1 pt-4 text-sm focus:outline-none"
        style={{ borderColor: 'var(--brand-primary)' }}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-0 top-1 text-xs font-medium transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-focus:top-1 peer-focus:text-xs"
        style={{ color: 'var(--brand-primary)' }}
      >
        {label}
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Field Renderer
// ---------------------------------------------------------------------------

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomField;
  value: string | boolean | string[] | undefined;
  onChange: (value: string | boolean | string[]) => void;
}) {
  const borderStyle = { borderColor: 'var(--brand-primary)' };
  const labelText = `${field.label}${field.required ? ' *' : ''}`;

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'number':
      return (
        <FloatingInput
          id={`cf-${field.id}`}
          label={labelText}
          type={field.type === 'phone' ? 'tel' : field.type}
          required={field.required}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'textarea':
      return (
        <div className="relative">
          <textarea
            id={`cf-${field.id}`}
            required={field.required}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder=" "
            rows={3}
            className="peer w-full resize-none border-0 border-b bg-transparent pb-1 pt-5 text-sm focus:outline-none"
            style={borderStyle}
          />
          <label
            htmlFor={`cf-${field.id}`}
            className="pointer-events-none absolute left-0 top-0 text-xs font-medium transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-0 peer-focus:text-xs"
            style={{ color: 'var(--brand-primary)' }}
          >
            {labelText}
          </label>
        </div>
      );

    case 'select':
      return (
        <div>
          <label htmlFor={`cf-${field.id}`} className="mb-1 block text-xs font-medium" style={{ color: 'var(--brand-primary)' }}>
            {labelText}
          </label>
          <select
            id={`cf-${field.id}`}
            required={field.required}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 w-full border-0 border-b bg-transparent text-sm focus:outline-none"
            style={borderStyle}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );

    case 'radio':
      return (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            {field.label} {field.required && '*'}
          </legend>
          <div className="space-y-2">
            {field.options?.map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`cf-${field.id}`}
                  value={opt}
                  required={field.required}
                  checked={(value as string) === opt}
                  onChange={() => onChange(opt)}
                  className="size-4"
                />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>
      );

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={(value as boolean) || false}
            onChange={(e) => onChange(e.target.checked)}
            className="size-4 rounded"
          />
          <span>
            {field.label} {field.required && '*'}
          </span>
        </label>
      );

    default:
      return null;
  }
}
