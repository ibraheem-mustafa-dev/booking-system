'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  InvoiceForm,
  type InvoiceFormValues,
} from '../../_components/invoice-form';

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery({
    id: params.id,
  });

  // Redirect to detail page if the invoice is not in pending status
  useEffect(() => {
    if (invoice && invoice.paymentStatus !== 'pending') {
      toast.error('Only pending invoices can be edited.');
      router.replace(`/dashboard/invoices/${params.id}`);
    }
  }, [invoice, params.id, router]);

  const updateMutation = trpc.invoices.update.useMutation({
    onSuccess: () => {
      toast.success('Invoice updated.');
      router.push(`/dashboard/invoices/${params.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function handleSubmit(values: InvoiceFormValues) {
    updateMutation.mutate({
      id: params.id,
      clientName: values.clientName,
      clientEmail: values.clientEmail,
      lineItems: values.lineItems,
      vatRate: values.vatRate,
      notes: values.notes || undefined,
      dueDate: values.dueDate,
    });
  }

  if (isLoading) {
    return (
      <>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Skeleton className="h-4 w-32" />
        </header>
        <div className="p-6 md:p-8">
          <div className="mx-auto max-w-3xl space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </>
    );
  }

  if (!invoice) {
    return null; // Redirect handled by useEffect
  }

  // Map existing line items to the form's expected shape
  const existingLineItems = (
    (invoice.lineItems ?? []) as {
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[]
  ).map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));

  return (
    <>
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => router.push(`/dashboard/invoices/${params.id}`)}
        >
          <ArrowLeft className="mr-1 size-4" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-sm font-medium">
          Edit {invoice.invoiceNumber}
        </h1>
      </header>

      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-3xl">
          <InvoiceForm
            initialValues={{
              clientName: invoice.clientName,
              clientEmail: invoice.clientEmail,
              lineItems: existingLineItems,
              vatRate: parseFloat(invoice.vatRate ?? '0'),
              notes: invoice.notes ?? '',
              dueDate: invoice.dueDate,
            }}
            onSubmit={handleSubmit}
            isPending={updateMutation.isPending}
            submitLabel="Update Invoice"
          />
        </div>
      </div>
    </>
  );
}
