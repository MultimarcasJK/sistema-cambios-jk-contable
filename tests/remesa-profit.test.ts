import { describe, expect, it } from 'vitest';
import { gananciaRemesasEl } from '@/lib/remesa-profit';
import { packClosureMeta, unpackClosureMeta } from '@/lib/client-fee';

const r = (estado: string, fecha_pago: string | undefined, ganancia_usd: number) =>
  ({ estado, fecha_pago, ganancia_usd }) as any;

describe('ganancia de remesas del día', () => {
  it('solo cuenta las pagadas ese día', () => {
    const lista = [
      r('pagada', '2026-10-22', 3.5),
      r('pagada', '2026-10-22', 2),
      r('pagada', '2026-10-21', 10),
      r('cobrada', undefined, 7),
      r('anulada', undefined, 4),
    ];
    expect(gananciaRemesasEl(lista, '2026-10-22')).toBe(5.5);
  });
});

describe('marca del cierre con remesas', () => {
  it('guarda y lee la ganancia de remesas', () => {
    const packed = packClosureMeta('', { profit_detal: 1, profit_mayor: 2, extra_income: 0, total_expenses: 1, profit_remesas: 3.5 });
    expect(unpackClosureMeta(packed).profit_remesas).toBe(3.5);
  });

  it('lee cierres viejos sin remesas como 0', () => {
    expect(unpackClosureMeta('[CIERRE|D:0|M:30.85|I:0|G:25.5]').profit_remesas).toBe(0);
  });
});
