import { describe, expect, it } from 'vitest';
import { adelantoPeriod, isAdelanto, pendingAdelantos, pendingAdelantosTotal } from '@/lib/adelantos';
import { PayrollPayment } from '@/types';

const pago = (id: string, employee_id: string, period: string, net: number, created_at: string): PayrollPayment => ({
  id,
  date: created_at.slice(0, 10),
  employee_id,
  employee_name: 'DARIO',
  period,
  base_amount: net,
  bonuses: 0,
  deductions: 0,
  net_amount: net,
  currency: 'USD',
  amount_currency: net,
  exchange_rate: 1,
  amount_usd: net,
  created_at,
});

describe('Adelantos de sueldo', () => {
  it('reconoce el período de adelanto', () => {
    expect(adelantoPeriod('2da Quincena Octubre 2026')).toBe('ADELANTO - 2da Quincena Octubre 2026');
    expect(isAdelanto({ period: 'adelanto - Octubre' })).toBe(true);
    expect(isAdelanto({ period: '1ra Quincena Octubre 2026' })).toBe(false);
  });

  it('acumula solo los adelantos posteriores al último pago de sueldo', () => {
    const pagos = [
      pago('a0', 'emp-1', 'ADELANTO - 1ra Quincena', 20, '2026-10-05T10:00:00.000Z'),
      pago('p1', 'emp-1', '1ra Quincena Octubre 2026', 180, '2026-10-15T10:00:00.000Z'),
      pago('a1', 'emp-1', 'ADELANTO - 2da Quincena', 50, '2026-10-20T10:00:00.000Z'),
      pago('a2', 'emp-1', 'ADELANTO - 2da Quincena', 30, '2026-10-24T10:00:00.000Z'),
      pago('x1', 'emp-2', 'ADELANTO - 2da Quincena', 99, '2026-10-24T10:00:00.000Z'),
    ];
    expect(pendingAdelantos(pagos, 'emp-1').map((p) => p.id)).toEqual(['a1', 'a2']);
    expect(pendingAdelantosTotal(pagos, 'emp-1')).toBe(80);
    expect(pendingAdelantosTotal(pagos, 'emp-2')).toBe(99);
  });

  it('el pago de sueldo los salda y, si se anula, vuelven a quedar pendientes', () => {
    const adelanto = pago('a1', 'emp-1', 'ADELANTO - 2da Quincena', 50, '2026-10-20T10:00:00.000Z');
    const sueldo = pago('p2', 'emp-1', '2da Quincena Octubre 2026', 150, '2026-10-30T10:00:00.000Z');
    expect(pendingAdelantosTotal([adelanto, sueldo], 'emp-1')).toBe(0);
    expect(pendingAdelantosTotal([adelanto], 'emp-1')).toBe(50);
  });
});
