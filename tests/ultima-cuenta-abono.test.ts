import { describe, it, expect, beforeEach } from 'vitest';
import { getUltimaCuentaAbono, setUltimaCuentaAbono } from '@/lib/ultima-cuenta-abono';

const cuentas = [{ id: 'acc-1' }, { id: 'acc-2' }];

describe('última cuenta usada en Registrar Abono', () => {
  beforeEach(() => localStorage.clear());

  it('sin abonos previos queda Caja General', () => {
    expect(getUltimaCuentaAbono('detal', cuentas)).toBe('');
  });

  it('recuerda la cuenta del último abono hasta que se cambie', () => {
    setUltimaCuentaAbono('detal', 'acc-2');
    expect(getUltimaCuentaAbono('detal', cuentas)).toBe('acc-2');
    setUltimaCuentaAbono('detal', 'acc-1');
    expect(getUltimaCuentaAbono('detal', cuentas)).toBe('acc-1');
  });

  it('si se elige Caja General, se recuerda Caja General', () => {
    setUltimaCuentaAbono('detal', 'acc-1');
    setUltimaCuentaAbono('detal', '');
    expect(getUltimaCuentaAbono('detal', cuentas)).toBe('');
  });

  it('Detal y Mayor recuerdan cada uno su cuenta', () => {
    setUltimaCuentaAbono('detal', 'acc-1');
    setUltimaCuentaAbono('mayor', 'acc-2');
    expect(getUltimaCuentaAbono('detal', cuentas)).toBe('acc-1');
    expect(getUltimaCuentaAbono('mayor', cuentas)).toBe('acc-2');
  });

  it('si la cuenta ya no existe, vuelve a Caja General', () => {
    setUltimaCuentaAbono('detal', 'acc-borrada');
    expect(getUltimaCuentaAbono('detal', cuentas)).toBe('');
  });
});
