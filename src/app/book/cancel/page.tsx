'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface BookingSummary {
  clientName: string;
  bookingTypeName: string;
  startAt: string;
  timezone: string;
}

export default function CancelBookingPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No cancellation token provided.');
      setLoading(false);
      return;
    }

    fetch(`/api/v1/booking/lookup?token=${encodeURIComponent(token)}&type=cancel`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setBooking(data);
        }
      })
      .catch(() => setError('Failed to load booking details.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCancel() {
    if (!token) return;
    setCancelling(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/booking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to cancel booking.');
        return;
      }

      setCancelled(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

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

  if (error && !booking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-100">
            <svg className="size-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Unable to Cancel</h1>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100">
            <svg className="size-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Booking Cancelled</h1>
          <p className="mt-2 text-sm text-gray-500">
            Your booking has been cancelled. A confirmation email has been sent.
          </p>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const startDate = new Date(booking.startAt);
  const dateFormatted = startDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: booking.timezone,
  });
  const timeFormatted = startDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: booking.timezone,
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Cancel Booking</h1>
        <p className="mt-2 text-sm text-gray-500">
          Are you sure you want to cancel this booking?
        </p>

        <div className="mt-6 rounded-lg bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">{booking.bookingTypeName}</p>
          <p className="mt-1 text-sm text-gray-600">{dateFormatted}</p>
          <p className="text-sm text-gray-600">{timeFormatted} ({booking.timezone})</p>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gray-300 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="flex h-11 flex-1 items-center justify-center rounded-lg bg-red-600 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {cancelling ? 'Cancelling...' : 'Cancel booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
