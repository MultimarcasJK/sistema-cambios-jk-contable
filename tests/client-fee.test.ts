import { describe, it, expect } from 'vitest';
import { packClientFee, unpackClientFee } from '@/lib/client-fee';

describe('comisión al cliente guardada en notas', () => {
  it('ida y vuelta con VIP y $1', () => {
    const packed = packClientFee('pago en efectivo', 1, true);
    expect(packed).toBe('pago en efectivo [VIP|COMCLI:1]');
    expect(unpackClientFee(packed)).toEqual({ notes: 'pago en efectivo', client_fee: 1, is_vip: true });
  });

  it('comisión sin VIP y notas vacías', () => {
    const packed = packClientFee('', 2.5, false);
    expect(packed).toBe('[COMCLI:2.5]');
    expect(unpackClientFee(packed)).toEqual({ notes: '', client_fee: 2.5, is_vip: undefined });
  });

  it('sin comisión no toca las notas', () => {
    expect(packClientFee('hola', undefined, undefined)).toBe('hola');
    expect(unpackClientFee('hola')).toEqual({ notes: 'hola' });
  });

  it('no duplica la marca al volver a guardar', () => {
    const once = packClientFee('x', 1, true);
    expect(packClientFee(once, 1, true)).toBe(once);
  });
});
