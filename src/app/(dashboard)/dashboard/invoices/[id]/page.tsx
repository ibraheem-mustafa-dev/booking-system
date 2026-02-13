'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Mail,
  Pencil,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '\u00a3',
  EUR: '\u20ac',
  USD: '$',
};

function formatCurrency(amount: string | number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency + ' ';
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  return `${symbol}${num.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>;
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
    case 'refunded':
      return <Badge variant="secondary">Refunded</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateLong(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery({
    id: params.id,
  });

  const markPaid = trpc.invoices.markPaid.useMutation({
    onSuccess: () => {
      utils.invoices.getById.invalidate({ id: params.id });
      utils.invoices.list.invalidate();
      toast.success('Invoice marked as paid.');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const markRefunded = trpc.invoices.markRefunded.useMutation({
    onSuccess: () => {
      utils.invoices.getById.invalidate({ id: params.id });
      utils.invoices.list.invalidate();
      toast.success('Invoice marked as refunded.');
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

  async function handleDownloadPdf() {
    if (!invoice) return;
    try {
      const result = await utils.invoices.downloadPdf.fetch({ id: invoice.id });
      const byteChars = atob(result.base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF.');
    }
  }

  if (isLoading) {
    return (
      <>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Skeleton className="h-4 w-24" />
        </header>
        <div className="p-6 md:p-8">
          <div className="mx-auto max-w-3xl space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <h1 className="text-sm font-medium">Invoice not found</h1>
        </header>
        <div className="flex flex-col items-center justify-center p-12">
          <p className="mb-4 text-muted-foreground">
            This invoice could not be found.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/invoices">Back to invoices</Link>
          </Button>
        </div>
      </>
    );
  }

  const lineItems = (invoice.lineItems ?? []) as {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];

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
        <h1 className="text-sm font-medium">{invoice.invoiceNumber}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Download className="mr-2 size-4" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resendEmail.mutate({ id: invoice.id })}
            disabled={resendEmail.isPending}
          >
            <Mail className="mr-2 size-4" />
            {resendEmail.isPending ? 'Sending...' : 'Resend Email'}
          </Button>
          {invoice.paymentStatus === 'pending' && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Link>
              </Button>
              <Button
                size="sm"
                onClick={() => markPaid.mutate({ id: invoice.id })}
                disabled={markPaid.isPending}
              >
                <CheckCircle2 className="mr-2 size-4" />
                {markPaid.isPending ? 'Updating...' : 'Mark Paid'}
              </Button>
            </>
          )}
          {invoice.paymentStatus === 'paid' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markRefunded.mutate({ id: invoice.id })}
              disabled={markRefunded.isPending}
            >
              <RotateCcw className="mr-2 size-4" />
              {markRefunded.isPending ? 'Updating...' : 'Mark Refunded'}
            </Button>
          )}
        </div>
      </header>

      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Invoice header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                Invoice {invoice.invoiceNumber}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Created {formatDateLong(invoice.createdAt)}
              </p>
            </div>
            <StatusBadge status={invoice.paymentStatus} />
          </div>

          {/* Booking reference */}
          {invoice.bookingReference && (
            <Card>
              <CardContent className="py-3">
                <p className="text-sm text-muted-foreground">
                  Linked booking: <strong>{invoice.bookingReference}</strong>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Invoice details */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Client details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Billed To
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{invoice.clientName}</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.clientEmail}
                </p>
              </CardContent>
            </Card>

            {/* Invoice meta */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Date</span>
                  <span>{formatDate(invoice.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{formatDate(invoice.dueDate + 'T00:00:00')}</span>
                </div>
                {invoice.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid</span>
                    <span>{formatDate(invoice.paidAt)}</span>
                  </div>
                )}
                {invoice.paymentMethod && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span>{invoice.paymentMethod}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Line items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">
                        Description
                      </th>
                      <th className="px-4 py-2 text-right font-medium">Qty</th>
                      <th className="px-4 py-2 text-right font-medium">
                        Unit Price
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => (
                      <tr key={index} className="border-b last:border-b-0">
                        <td className="px-4 py-2">{item.description}</td>
                        <td className="px-4 py-2 text-right">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(item.unitPrice, invoice.currency)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(item.total, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between px-4">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>
                    {formatCurrency(invoice.subtotal, invoice.currency)}
                  </span>
                </div>
                {parseFloat(invoice.vatRate ?? '0') > 0 && (
                  <div className="flex justify-between px-4">
                    <span className="text-muted-foreground">
                      VAT ({invoice.vatRate}%)
                    </span>
                    <span>
                      {formatCurrency(
                        invoice.vatAmount ?? '0',
                        invoice.currency,
                      )}
                    </span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between px-4 text-base font-bold">
                  <span>Total</span>
                  <span>
                    {formatCurrency(invoice.total, invoice.currency)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {invoice.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
