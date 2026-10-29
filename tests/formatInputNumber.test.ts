import { describe, expect, it } from 'vitest';
import { formatInputNumber, parseFormattedNumber } from '@/lib/formatters';

describe('formatInputNumber', () => {
  it('quita el signo menos si no se permiten negativos', () => {
    expect(formatInputNumber('-1110')).toBe('1,110');
  });

  it('acepta negativos cuando se permite', () => {
    expect(formatInputNumber('-', true)).toBe('-');
    expect(formatInputNumber('-1110.5', true)).toBe('-1,110.5');
    expect(parseFormattedNumber(formatInputNumber('-27293.89', true))).toBe(-27293.89);
  });

  it('ignora un menos en medio del número', () => {
    expect(formatInputNumber('12-3', true)).toBe('123');
  });
});
