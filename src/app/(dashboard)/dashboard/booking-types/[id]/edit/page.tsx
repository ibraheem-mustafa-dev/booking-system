'use client';

import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { BookingTypeForm } from '../../_components/booking-type-form';

export default function EditBookingTypePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: bookingType, isLoading } =
    trpc.bookingTypes.getById.useQuery({ id: params.id });

  const updateMutation = trpc.bookingTypes.update.useMutation({
    onSuccess: (updated) => {
      toast.success(`${updated.name} updated`);
      router.push('/dashboard/booking-types');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <>
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-sm font-medium">
          {isLoading ? 'Loading...' : `Edit ${bookingType?.name ?? ''}`}
        </h1>
      </header>

      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-3xl">
          {isLoading && (
            <div className="space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {bookingType && (
            <BookingTypeForm
              defaultValues={{
                name: bookingType.name,
                description: bookingType.description ?? '',
                durationMins: bookingType.durationMins,
                bufferMins: bookingType.bufferMins,
                locationType: bookingType.locationType,
                locationDetails: bookingType.locationDetails ?? '',
                videoProvider: bookingType.videoProvider,
                colour: bookingType.colour,
                isActive: bookingType.isActive,
                maxAdvanceDays: bookingType.maxAdvanceDays,
                minNoticeHours: bookingType.minNoticeHours,
                requiresPayment: bookingType.requiresPayment,
                priceAmount: bookingType.priceAmount ?? '',
                priceCurrency: bookingType.priceCurrency ?? 'GBP',
                customFields: bookingType.customFields as {
                  fields: Array<{
                    id: string;
                    type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'email' | 'phone' | 'number';
                    label: string;
                    placeholder?: string;
                    required: boolean;
                    options?: string[];
                  }>;
                },
              }}
              onSubmit={(values) =>
                updateMutation.mutate({
                  id: params.id,
                  data: values,
                })
              }
              isPending={updateMutation.isPending}
              submitLabel="Save changes"
            />
          )}
        </div>
      </div>
    </>
  );
}
