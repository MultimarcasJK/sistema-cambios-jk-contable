import { describe, expect, it } from 'vitest';
import { adjustRateForUsdtPct, parseUsdtPct, currencyUsesUsdtPct, usdtPctNote } from '../src/lib/usdt-premium';

describe('% de compra de USDT sobre la tasa', () => {
  it('en contra baja la tasa', () => {
    expect(adjustRateForUsdtPct(200, -1.3)).toBe(197.4334);
  });
  it('a favor sube la tasa', () => {
    expect(adjustRateForUsdtPct(200, 0.5)).toBe(201.005);
  });
  it('sin % no cambia', () => {
    expect(adjustRateForUsdtPct(200, 0)).toBe(200);
  });
  it('lee el % escrito a mano', () => {
    expect(parseUsdtPct('-1,3')).toBe(-1.3);
    expect(parseUsdtPct('+0.5%')).toBe(0.5);
    expect(parseUsdtPct('')).toBe(0);
    expect(parseUsdtPct('abc')).toBe(0);
  });
  it('solo aplica a monedas pagadas con USDT', () => {
    expect(currencyUsesUsdtPct('VES')).toBe(true);
    expect(currencyUsesUsdtPct('USDT')).toBe(false);
    expect(currencyUsesUsdtPct('EUR')).toBe(false);
  });
  it('deja nota de la compra', () => {
    expect(usdtPctNote(200, -1.3)).toBe('% compra USDT -1.3% en contra (tasa base 200)');
  });
});
