import { describe, expect, it } from 'vitest';
import { packPurchaseRate, rateFromPurchase, unpackPurchaseRate } from '@/lib/client-fee';

describe('tasa de compras a proveedores', () => {
  it('la tasa viaja en notes y se recupera sin ensuciar la nota', () => {
    const packed = packPurchaseRate('pago móvil', 995.25);
    expect(unpackPurchaseRate(packed)).toEqual({ notes: 'pago móvil', buy_price: 995.25 });
    expect(unpackPurchaseRate(packPurchaseRate('', 1.004))).toEqual({ notes: '', buy_price: 1.004 });
    // Volver a guardar no duplica la marca
    expect(packPurchaseRate(packed, 990)).toBe('pago móvil [TASA:990]');
  });

  it('las compras viejas sin marca recuperan la tasa de cantidad y costo', () => {
    expect(rateFromPurchase('USDT', 1988000, 1997.99)).toBeCloseTo(995, 0);
    expect(rateFromPurchase('USDT', 10040, 10000)).toBe(1.004);
    expect(rateFromPurchase('EUR', 100, 108)).toBe(1.08);
    expect(rateFromPurchase('USD', 500, 500)).toBe(1);
    expect(rateFromPurchase('VES', 0, 0)).toBe(0);
  });
});
