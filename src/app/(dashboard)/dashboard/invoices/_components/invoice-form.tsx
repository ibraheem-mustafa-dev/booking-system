'use client';

import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceFormValues {
  clientName: string;
  clientEmail: string;
  lineItems: LineItemInput[];
  vatRate: number;
  notes: string;
  dueDate: string;
}

interface InvoiceFormProps {
  initialValues?: Partial<InvoiceFormValues>;
  onSubmit: (values: InvoiceFormValues) => void;
  onSubmitAndSend?: (values: InvoiceFormValues) => void;
  isPending: boolean;
  submitLabel: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvoiceForm({
  initialValues,
  onSubmit,
  onSubmitAndSend,
  isPending,
  submitLabel,
}: InvoiceFormProps) {
  const [clientName, setClientName] = useState(
    initialValues?.clientName ?? '',
  );
  const [clientEmail, setClientEmail] = useState(
    initialValues?.clientEmail ?? '',
  );
  const [lineItems, setLineItems] = useState<LineItemInput[]>(
    initialValues?.lineItems?.length
      ? initialValues.lineItems
      : [{ description: '', quantity: 1, unitPrice: 0 }],
  );
  const [vatRate, setVatRate] = useState(initialValues?.vatRate ?? 0);
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? todayISO());

  function updateLineItem(
    index: number,
    field: keyof LineItemInput,
    value: string | number,
  ) {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unitPrice: 0 },
    ]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function buildValues(): InvoiceFormValues {
    return {
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      lineItems: lineItems.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
      })),
      vatRate: Number(vatRate) || 0,
      notes: notes.trim(),
      dueDate,
    };
  }

  // Calculate totals for display
  const subtotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );
  const vatAmount = subtotal * ((Number(vatRate) || 0) / 100);
  const total = subtotal + vatAmount;

  return (
    <div className="space-y-6">
      {/* Client details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="John Smith"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Client Email</Label>
              <Input
                id="clientEmail"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Header row (hidden on mobile) */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_80px_120px_40px] sm:gap-3">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Label className="text-xs text-muted-foreground">Qty</Label>
            <Label className="text-xs text-muted-foreground">Unit Price</Label>
            <span />
          </div>

          {lineItems.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 sm:grid-cols-[1fr_80px_120px_40px]"
            >
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">
                  Description
                </Label>
                <Input
                  value={item.description}
                  onChange={(e) =>
                    updateLineItem(index, 'description', e.target.value)
                  }
                  placeholder="Service description"
                />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">
                  Qty
                </Label>
                <Input
                  type="number"
                  min={0.01}
                  step={1}
                  value={item.quantity}
                  onChange={(e) =>
                    updateLineItem(
                      index,
                      'quantity',
                      parseFloat(e.target.value) || 0,
                    )
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">
                  Unit Price (&pound;)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateLineItem(
                      index,
                      'unitPrice',
                      parseFloat(e.target.value) || 0,
                    )
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  disabled={lineItems.length <= 1}
                  onClick={() => removeLineItem(index)}
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Remove line item</span>
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLineItem}
          >
            <Plus className="mr-2 size-4" />
            Add line item
          </Button>
        </CardContent>
      </Card>

      {/* VAT and totals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vatRate">VAT Rate (%)</Label>
              <Input
                id="vatRate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={vatRate}
                onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Calculated totals */}
          <div className="rounded-md bg-muted/50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>&pound;{subtotal.toFixed(2)}</span>
            </div>
            {vatRate > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  VAT ({vatRate}%)
                </span>
                <span>&pound;{vatAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t pt-2 font-bold">
              <span>Total</span>
              <span>&pound;{total.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for the client (e.g. payment instructions, thank you message)"
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit buttons */}
      <div className="flex justify-end gap-3">
        {onSubmitAndSend && (
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => onSubmitAndSend(buildValues())}
          >
            {isPending ? 'Saving...' : 'Save & Send'}
          </Button>
        )}
        <Button disabled={isPending} onClick={() => onSubmit(buildValues())}>
          {isPending ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
