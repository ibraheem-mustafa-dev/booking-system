'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Plus,
  MoreHorizontal,
  Eye,
  Download,
  Mail,
  CheckCircle2,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '\u00a3',
  EUR: '\u20ac',
  USD: '$',
};

function formatCurrency(amount: string, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency + ' ';
  return `${symbol}${parseFloat(amount).toFixed(2)}`;
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
// Date formatting (DD/MM/YYYY)
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoicesPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.invoices.list.useQuery({ page, limit: 20 });

  const markPaid = trpc.invoices.markPaid.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate();
      toast.success('Invoice marked as paid.');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const markRefunded = trpc.invoices.markRefunded.useMutation({
    onSuccess: () => {
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

  async function handleDownloadPdf(invoiceId: string, invoiceNumber: string) {
    try {
      const result = await utils.invoices.downloadPdf.fetch({ id: invoiceId });
      const byteChars = atob(result.base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF.');
    }
  }

  return (
    <>
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <h1 className="text-sm font-medium">Invoices</h1>
        <div className="ml-auto">
          <Button asChild size="sm">
            <Link href="/dashboard/invoices/new">
              <Plus className="mr-2 size-4" />
              New invoice
            </Link>
          </Button>
        </div>
      </header>

      <div className="p-6 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Loading skeleton */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && data?.invoices.length === 0 && (
            <Card className="border-dashed border-2">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                  <FileText className="size-6 text-muted-foreground" />
                </div>
                <CardTitle>No invoices yet</CardTitle>
                <CardDescription>
                  Create your first invoice or they will be generated
                  automatically for paid bookings.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button asChild>
                  <Link href="/dashboard/invoices/new">
                    <Plus className="mr-2 size-4" />
                    Create invoice
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Invoice table */}
          {!isLoading && data && data.invoices.length > 0 && (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-10">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.invoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(`/dashboard/invoices/${invoice.id}`)
                        }
                      >
                        <TableCell className="font-medium">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{invoice.clientName}</p>
                            <p className="text-xs text-muted-foreground">
                              {invoice.clientEmail}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.total, invoice.currency)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={invoice.paymentStatus} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(invoice.createdAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(
                                    `/dashboard/invoices/${invoice.id}`,
                                  );
                                }}
                              >
                                <Eye className="mr-2 size-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadPdf(
                                    invoice.id,
                                    invoice.invoiceNumber,
                                  );
                                }}
                              >
                                <Download className="mr-2 size-4" />
                                Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resendEmail.mutate({ id: invoice.id });
                                }}
                              >
                                <Mail className="mr-2 size-4" />
                                Resend Email
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {invoice.paymentStatus === 'pending' && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markPaid.mutate({ id: invoice.id });
                                  }}
                                >
                                  <CheckCircle2 className="mr-2 size-4" />
                                  Mark Paid
                                </DropdownMenuItem>
                              )}
                              {invoice.paymentStatus === 'paid' && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markRefunded.mutate({ id: invoice.id });
                                  }}
                                >
                                  <RotateCcw className="mr-2 size-4" />
                                  Mark Refunded
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages} ({data.total}{' '}
                    {data.total === 1 ? 'invoice' : 'invoices'})
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
