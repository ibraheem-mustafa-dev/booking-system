'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  lineItems: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  total: string;
  currency: string;
  paymentStatus: string;
  dueDate: string;
  orgName: string;
  orgLogoUrl?: string;
  primaryColour: string;
}

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

export default function ClientInvoicePage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/invoices/${params.id}/public`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInvoice(data);
        }
      })
      .catch(() => setError('Failed to load invoice.'))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handlePay() {
    if (!invoice) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/checkout`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to start payment.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-lg rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
          <p className="mt-4 text-sm text-gray-500">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-lg rounded-xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Invoice Not Found</h1>
          <p className="mt-2 text-sm text-gray-500">{error || 'This invoice could not be found.'}</p>
        </div>
      </div>
    );
  }

  const isPaid = invoice.paymentStatus === 'paid';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-white p-8 shadow-sm">
        {/* Header */}
        {invoice.orgLogoUrl ? (
          <img src={invoice.orgLogoUrl} alt={invoice.orgName} className="mb-4 h-10" />
        ) : (
          <p className="mb-4 text-lg font-bold" style={{ color: invoice.primaryColour }}>
            {invoice.orgName}
          </p>
        )}

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Invoice {invoice.invoiceNumber}</h1>
            <p className="text-sm text-gray-500">Due: {invoice.dueDate}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isPaid
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isPaid ? 'Paid' : 'Pending'}
          </span>
        </div>

        {/* Client */}
        <div className="mt-6 rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Billed to</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{invoice.clientName}</p>
          <p className="text-sm text-gray-500">{invoice.clientEmail}</p>
        </div>

        {/* Line items */}
        <div className="mt-6">
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Item</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Qty</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Price</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-4 py-2 text-gray-900">{item.description}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(item.total, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between px-4">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            {parseFloat(invoice.vatRate) > 0 && (
              <div className="flex justify-between px-4">
                <span className="text-gray-500">VAT ({invoice.vatRate}%)</span>
                <span>{formatCurrency(invoice.vatAmount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t px-4 pt-2 text-base font-bold">
              <span>Total</span>
              <span>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {/* Pay button */}
        {!isPaid && (
          <button
            type="button"
            onClick={handlePay}
            disabled={paying}
            className="mt-6 flex h-12 w-full items-center justify-center rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: invoice.primaryColour }}
          >
            {paying ? 'Redirecting to payment...' : `Pay ${formatCurrency(invoice.total, invoice.currency)} now`}
          </button>
        )}
      </div>
    </div>
  );
}
