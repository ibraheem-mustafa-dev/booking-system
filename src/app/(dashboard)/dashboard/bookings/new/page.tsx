'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function NewBookingPage() {
  const router = useRouter();

  const [bookingTypeId, setBookingTypeId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');

  const { data: bookingTypes, isLoading: loadingTypes } =
    trpc.bookingTypes.list.useQuery();

  const createBooking = trpc.bookings.create.useMutation({
    onSuccess: () => {
      toast.success('Booking created');
      router.push('/dashboard/bookings');
    },
    onError: (error) => {
      toast.error(`Failed to create booking: ${error.message}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bookingTypeId || !clientName || !clientEmail || !date || !startTime || !endTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    const startAt = new Date(`${date}T${startTime}:00`).toISOString();
    const endAt = new Date(`${date}T${endTime}:00`).toISOString();

    await createBooking.mutateAsync({
      bookingTypeId,
      clientName,
      clientEmail,
      clientPhone: clientPhone || undefined,
      startAt,
      endAt,
      notes: notes || undefined,
      location: location || undefined,
    });
  };

  // Auto-set end time when booking type and start time change
  const handleStartTimeChange = (value: string) => {
    setStartTime(value);

    if (value && bookingTypeId) {
      const selectedType = bookingTypes?.find((t) => t.id === bookingTypeId);
      if (selectedType) {
        const [hours, minutes] = value.split(':').map(Number);
        const endMinutes = hours * 60 + minutes + selectedType.duration;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        setEndTime(
          `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
        );
      }
    }
  };

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
        <h1 className="text-lg font-semibold">New Booking</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Create Booking</CardTitle>
              <CardDescription>
                Add a new booking manually from the dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Booking Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Booking Type <span className="text-destructive">*</span>
                  </label>
                  {loadingTypes ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select value={bookingTypeId} onValueChange={setBookingTypeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a booking type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {bookingTypes?.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} ({type.duration} min)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Client Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Client Details
                  </h3>

                  <div className="space-y-2">
                    <label htmlFor="clientName" className="text-sm font-medium">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="clientName"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="John Smith"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="clientEmail" className="text-sm font-medium">
                      Email <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="clientEmail"
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="john@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="clientPhone" className="text-sm font-medium">
                      Phone
                    </label>
                    <Input
                      id="clientPhone"
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+44 7700 900000"
                    />
                  </div>
                </div>

                {/* Date & Time */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Date & Time
                  </h3>

                  <div className="space-y-2">
                    <label htmlFor="date" className="text-sm font-medium">
                      Date <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="startTime" className="text-sm font-medium">
                        Start <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => handleStartTimeChange(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="endTime" className="text-sm font-medium">
                        End <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Optional */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Optional
                  </h3>

                  <div className="space-y-2">
                    <label htmlFor="location" className="text-sm font-medium">
                      Location
                    </label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Office, Zoom link, etc."
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="notes" className="text-sm font-medium">
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional notes..."
                      rows={3}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={createBooking.isPending}
                >
                  {createBooking.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Booking'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
