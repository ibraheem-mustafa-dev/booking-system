'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  InvoiceForm,
  type InvoiceFormValues,
} from '../_components/invoice-form';

export default function NewInvoicePage() {
  const router = useRouter();

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: (created) => {
      toast.success(`Invoice ${created.invoiceNumber} created.`);
      router.push(`/dashboard/invoices/${created.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resendEmail = trpc.invoices.resendEmail.useMutation({
    onSuccess: () => {
      toast.success('Invoice email sent.');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function handleSubmit(values: InvoiceFormValues) {
    createMutation.mutate({
      clientName: values.clientName,
      clientEmail: values.clientEmail,
      lineItems: values.lineItems,
      vatRate: values.vatRate,
      notes: values.notes || undefined,
      dueDate: values.dueDate,
    });
  }

  function handleSubmitAndSend(values: InvoiceFormValues) {
    createMutation.mutate(
      {
        clientName: values.clientName,
        clientEmail: values.clientEmail,
        lineItems: values.lineItems,
        vatRate: values.vatRate,
        notes: values.notes || undefined,
        dueDate: values.dueDate,
      },
      {
        onSuccess: (created) => {
          resendEmail.mutate({ id: created.id });
          router.push(`/dashboard/invoices/${created.id}`);
        },
      },
    );
  }

  return (
    <>
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => router.push('/dashboard/invoices')}
        >
          <ArrowLeft className="mr-1 size-4" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-sm font-medium">New Invoice</h1>
      </header>

      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-3xl">
          <InvoiceForm
            onSubmit={handleSubmit}
            onSubmitAndSend={handleSubmitAndSend}
            isPending={createMutation.isPending || resendEmail.isPending}
            submitLabel="Save Draft"
          />
        </div>
      </div>
    </>
  );
}
