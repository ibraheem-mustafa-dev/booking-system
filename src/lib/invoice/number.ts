/**
 * Parse the numeric suffix from an invoice number string.
 * Returns 0 if the input is null or unparseable.
 */
export function parseInvoiceNumber(invoiceNumber: string | null): number {
  if (!invoiceNumber) return 0;
  const match = invoiceNumber.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Format a sequential number as an invoice number string.
 * Pads to 4 digits minimum: 1 -> "INV-0001", 10000 -> "INV-10000".
 */
export function formatInvoiceNumber(seq: number): string {
  return `INV-${String(seq).padStart(4, '0')}`;
}
