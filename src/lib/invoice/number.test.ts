import { describe, it, expect } from 'vitest';
import { parseInvoiceNumber, formatInvoiceNumber } from './number';

describe('parseInvoiceNumber', () => {
  it('extracts the numeric part from INV-0001', () => {
    expect(parseInvoiceNumber('INV-0001')).toBe(1);
  });

  it('extracts the numeric part from INV-0042', () => {
    expect(parseInvoiceNumber('INV-0042')).toBe(42);
  });

  it('returns 0 for null input', () => {
    expect(parseInvoiceNumber(null)).toBe(0);
  });
});

describe('formatInvoiceNumber', () => {
  it('formats 1 as INV-0001', () => {
    expect(formatInvoiceNumber(1)).toBe('INV-0001');
  });

  it('formats 42 as INV-0042', () => {
    expect(formatInvoiceNumber(42)).toBe('INV-0042');
  });

  it('formats 9999 as INV-9999', () => {
    expect(formatInvoiceNumber(9999)).toBe('INV-9999');
  });

  it('formats 10000 as INV-10000 (no truncation)', () => {
    expect(formatInvoiceNumber(10000)).toBe('INV-10000');
  });
});
