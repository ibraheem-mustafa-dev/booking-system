import { describe, it, expect } from 'vitest';
import { replacePlaceholders } from './helpers';

describe('replacePlaceholders', () => {
  it('replaces known placeholders with their values', () => {
    const template = 'Hi {{clientName}}, your booking for {{bookingType}} is confirmed.';
    const values = {
      clientName: 'Jane',
      bookingType: 'Discovery Call',
    };

    const result = replacePlaceholders(template, values);

    expect(result).toBe('Hi Jane, your booking for Discovery Call is confirmed.');
  });

  it('leaves unknown placeholders untouched', () => {
    const template = 'Hi {{clientName}}, your code is {{discountCode}}.';
    const values = {
      clientName: 'Bean',
    };

    const result = replacePlaceholders(template, values);

    expect(result).toBe('Hi Bean, your code is {{discountCode}}.');
  });
});
