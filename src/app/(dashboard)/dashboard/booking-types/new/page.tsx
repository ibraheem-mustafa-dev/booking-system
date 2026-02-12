'use client';

import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { BookingTypeForm } from '../_components/booking-type-form';

export default function NewBookingTypePage() {
  const router = useRouter();

  const createMutation = trpc.bookingTypes.create.useMutation({
    onSuccess: (created) => {
      toast.success(`${created.name} created`);
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
        <h1 className="text-sm font-medium">New booking type</h1>
      </header>

      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-3xl">
          <BookingTypeForm
            onSubmit={(values) => createMutation.mutate(values)}
            isPending={createMutation.isPending}
            submitLabel="Create booking type"
          />
        </div>
      </div>
    </>
  );
}
