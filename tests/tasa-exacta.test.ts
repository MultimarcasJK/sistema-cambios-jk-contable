import { describe, expect, it } from 'vitest';
import { formatRateExact } from '@/lib/formatters';

describe('Tasa tal cual se anotó', () => {
  it('no redondea ni agrega ceros', () => {
    expect(formatRateExact(0.995)).toBe('0.995');
    expect(formatRateExact(1.00456)).toBe('1.00456');
    expect(formatRateExact(788)).toBe('788');
    expect(formatRateExact(4150.5)).toBe('4,150.5');
    expect(formatRateExact(undefined)).toBe('0');
  });
});
