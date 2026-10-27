import { describe, expect, it } from 'vitest';
import { buildDailyReport, cuadreDeCaja, cuentasUsadasEl, deudaDeVenta, saldosPorPais, textoDiferencia } from '@/lib/daily-report';
import { Account } from '@/types';

const DAY = '2026-10-26';

const cuenta = (id: string, currency: string, balance: number, extra: Partial<Account> = {}): Account =>
  ({ id, name: id.toUpperCase(), bank_name: 'BANCO', currency, type: 'banco', responsible: '', current_balance: balance, is_active: true, ...extra }) as Account;

describe('reporte del día', () => {
  const base = {
    date: DAY,
    mode: 'detal' as const,
    operadora: 'MARIA',
    createdAt: '2026-10-26T22:00:00.000Z',
    detalTxs: [
      { id: 'd1', date: DAY, client_name: 'A', usdt_amount: 100, sell_price: 1, buy_price: 1, total_to_pay: 102, amount_received: 102, profit_usd: 2, bank_fee: 0, payment_status: 'PAGADO' },
      { id: 'd2', date: DAY, client_name: 'B', usdt_amount: 50, sell_price: 1, buy_price: 1, total_to_pay: 51, amount_received: 20, profit_usd: 1, bank_fee: 0, payment_status: 'PARCIAL' },
      { id: 'd3', date: '2026-10-25', client_name: 'C', usdt_amount: 999, sell_price: 1, buy_price: 1, total_to_pay: 999, amount_received: 0, profit_usd: 9, bank_fee: 0, payment_status: 'PENDIENTE' },
    ] as any[],
    mayorTxs: [
      { id: 'm1', date: DAY, client_name: 'D', currency: 'VES', amount_ves: 10000, buy_price: 1, sell_price: 1, total_to_pay: 40, commission: 0, profit_usd: 3, payment_status: 'PENDIENTE' },
      { id: 'm2', date: DAY, client_name: 'E', currency: 'COP', amount_ves: 200000, buy_price: 1, sell_price: 1, total_to_pay: 50, commission: 0, profit_usd: 4, payment_status: 'PAGADO' },
      { id: 'm3', date: DAY, client_name: 'F', currency: 'VES', amount_ves: 5000, buy_price: 1, sell_price: 1, total_to_pay: 20, commission: 0, profit_usd: 1, payment_status: 'PAGADO' },
    ] as any[],
    expenses: [
      { id: 'e1', date: DAY, type: 'egreso', description: '', amount: 5, currency: 'USD', concept: 'LUZ', amount_usd: 5 },
      { id: 'e2', date: DAY, type: 'ingreso', description: '', amount: 3, currency: 'USD', concept: 'OTRO', amount_usd: 3 },
      { id: 'e3', date: DAY, type: 'ingreso', description: '', amount: 500, currency: 'USD', concept: 'DINERO APARTE', amount_usd: 500 },
    ] as any[],
    remesas: [
      { id: 'r1', date: DAY, estado: 'pagada', fecha_pago: DAY, ganancia_usd: 6, fiado_usd: 10, remitente_name: 'G' },
      { id: 'r2', date: DAY, estado: 'anulada', fiado_usd: 99, remitente_name: 'H' },
    ] as any[],
    debtPayments: [
      { id: 'p1', debtor_id: 'x', client_name: 'Z', date: DAY, amount: 15 },
      { id: 'p2', debtor_id: 'x', client_name: 'Z', date: '2026-10-20', amount: 70 },
    ],
    accounts: [cuenta('caja', 'USD', 100), cuenta('bdv', 'VES', 5000), cuenta('vieja', 'USD', 999, { is_active: false })],
  };

  it('suma ventas, ganancia, abonos y deudas nuevas solo del día', () => {
    const r = buildDailyReport(base);
    expect(r.ventas.cripto).toEqual({ count: 2, usdt: 150, facturado_usd: 153 });
    expect(r.ventas.regionales).toEqual([
      { currency: 'VES', count: 2, monto: 15000 },
      { currency: 'COP', count: 1, monto: 200000 },
    ]);
    expect(r.ventas.remesas_pagadas).toBe(1);
    // 3 + 8 + 6 + 3 - 5 (el dinero aparte no cuenta)
    expect(r.ganancia).toEqual({ cripto: 3, regionales: 8, remesas: 6, ingresos_extra: 3, gastos: 5, neta: 15 });
    expect(r.abonos).toEqual({ count: 1, total_usd: 15 });
    // PARCIAL 51-20 + PENDIENTE 40 + remesa fiada 10 (la anulada no)
    expect(r.deudas_nuevas).toEqual({ count: 3, total_usd: 81 });
    expect(r.saldos.map((s) => s.account_id)).toEqual(['caja', 'bdv']);
    expect(r.totales_moneda).toEqual({ USD: 100, VES: 5000 });
    expect(r.mode).toBe('detal');
    expect(r.operadora).toBe('MARIA');
  });

  it('sin cuentas contadas el cuadre queda en null', () => {
    expect(buildDailyReport(base).cuadra).toBeNull();
  });

  it('cuadra cuando lo contado coincide con el sistema', () => {
    const r = buildDailyReport({ ...base, reales: { caja: 100, bdv: 5000.001 } });
    expect(r.cuadra).toBe(true);
    expect(r.cuadre).toHaveLength(2);
  });

  it('marca lo que falta o sobra en cada cuenta', () => {
    const r = buildDailyReport({ ...base, reales: { caja: 90, bdv: 5200 } });
    expect(r.cuadra).toBe(false);
    expect(r.cuadre.map(textoDiferencia)).toEqual(['Falta 10.00 USD', 'Sobra 200.00 VES']);
  });

  it('las cuentas sin saldo escrito no entran en el cuadre', () => {
    const lineas = cuadreDeCaja(base.accounts, { caja: 100, bdv: undefined });
    expect(lineas.map((l) => l.account_id)).toEqual(['caja']);
  });

  it('deuda de una venta según su estado de pago', () => {
    expect(deudaDeVenta({ total_to_pay: 50, amount_received: 0, payment_status: 'PENDIENTE' })).toBe(50);
    expect(deudaDeVenta({ total_to_pay: 50, amount_received: 30, payment_status: 'PARCIAL' })).toBe(20);
    expect(deudaDeVenta({ total_to_pay: 50, amount_received: 50, payment_status: 'PAGADO' })).toBe(0);
  });
});

describe('cuentas usadas en el día', () => {
  const asiento = (fecha: string, unidad: 'detal' | 'mayor', cuentas: string[], origen = 'venta_detal') =>
    ({ id: 'x', fecha, orden: '', unidad, origen, origenId: 'x', descripcion: '', lineas: cuentas.map((c) => ({ cuenta: c, moneda: 'USD', debe: 1, haber: 0 })) }) as any;

  it('toma solo cuentas reales con movimientos ese día y en ese modo', () => {
    const ids = cuentasUsadasEl(
      [
        asiento(DAY, 'detal', ['CTA:caja', 'CXC', 'ING_VENTAS']),
        asiento(DAY, 'mayor', ['CTA:otra']),
        asiento('2026-10-25', 'detal', ['CTA:vieja']),
        asiento(DAY, 'detal', ['CTA:bdv'], 'apertura'),
      ],
      DAY,
      'detal'
    );
    expect([...ids]).toEqual(['caja']);
  });

  it('el reporte lleva las usadas más las que se contaron', () => {
    const accounts = [cuenta('caja', 'USD', 100), cuenta('bdv', 'VES', 5000), cuenta('zelle', 'USD', 7)];
    const r = buildDailyReport({
      date: DAY, mode: 'detal', operadora: 'X', detalTxs: [], mayorTxs: [], expenses: [], remesas: [], debtPayments: [],
      accounts, usedAccountIds: new Set(['caja']), reales: { zelle: 7 },
    });
    expect(r.saldos.map((s) => s.account_id)).toEqual(['caja', 'zelle']);
    expect(r.totales_moneda).toEqual({ USD: 107 });
    expect(r.cuadra).toBe(true);
  });
});

describe('saldos por país', () => {
  it('agrupa por país en el orden de la lista y suma cada uno', () => {
    const grupos = saldosPorPais([
      { account_id: 'a', name: 'BANESCO', bank_name: '', currency: 'VES', balance: 100, pais: 'VENEZUELA' },
      { account_id: 'b', name: 'PICHINCHA', bank_name: '', currency: 'USD', balance: 10, pais: 'ECUADOR' },
      { account_id: 'c', name: 'BDV', bank_name: '', currency: 'VES', balance: 50.5, pais: 'VENEZUELA' },
      { account_id: 'd', name: 'EFECTIVO', bank_name: '', currency: 'USD', balance: 5, pais: 'ECUADOR' },
    ] as any);
    expect(grupos.map((g) => [g.nombre, g.cuentas.length, g.totales])).toEqual([
      ['Ecuador', 2, { USD: 15 }],
      ['Venezuela', 2, { VES: 150.5 }],
    ]);
  });
});
