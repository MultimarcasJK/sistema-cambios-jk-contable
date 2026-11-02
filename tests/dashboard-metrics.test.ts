import { describe, it, expect } from 'vitest';
import {
  rangoPeriodo,
  gananciaPorDia,
  resumenPeriodo,
  variacion,
  liquidezPorMoneda,
  topClientes,
  resumenRemesas,
  cuadreUltimosDias,
} from '@/lib/dashboard-metrics';
import { Account, DailyReport, Expense, Remesa, TransactionDetal, TransactionMayor } from '@/types';

const mayor = (date: string, profit: number, total: number, client = 'ANA') =>
  ({ id: date + profit, date, client_name: client, total_to_pay: total, profit_usd: profit }) as TransactionMayor;
const detal = (date: string, profit: number, total: number) =>
  ({ id: 'd' + date + profit, date, client_name: 'LUIS', total_to_pay: total, profit_usd: profit }) as TransactionDetal;
const gasto = (date: string, usd: number, type: 'egreso' | 'ingreso' = 'egreso', concept = 'LUZ') =>
  ({ id: date + usd, date, type, amount_usd: usd, amount: usd, currency: 'USD', concept, description: '' }) as Expense;
const remesa = (p: Partial<Remesa>) => ({ estado: 'pagada', tasa_origen_usd: 1, total_cobrado: 0, ganancia_usd: 0, ...p }) as Remesa;

describe('dashboard: períodos', () => {
  it('mes se compara con el mes anterior hasta el mismo día', () => {
    expect(rangoPeriodo('mes', '2026-11-02')).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-02',
      prevDesde: '2026-10-01',
      prevHasta: '2026-10-02',
    });
    expect(rangoPeriodo('mes', '2026-03-31').prevHasta).toBe('2026-02-28');
  });

  it('7 días y rango libre', () => {
    expect(rangoPeriodo('7d', '2026-11-02')).toEqual({
      desde: '2026-10-27',
      hasta: '2026-11-02',
      prevDesde: '2026-10-20',
      prevHasta: '2026-10-26',
    });
    expect(rangoPeriodo('rango', '2026-11-02', '2026-10-10', '2026-10-01')).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-10',
      prevDesde: '2026-09-21',
      prevHasta: '2026-09-30',
    });
  });
});

describe('dashboard: ganancia', () => {
  const f = {
    detalTxs: [detal('2026-11-01', 10, 400)],
    mayorTxs: [mayor('2026-11-01', 30, 1000), mayor('2026-11-02', 20, 600), mayor('2026-10-15', 99, 5000)],
    remesas: [
      remesa({ date: '2026-11-01', fecha_pago: '2026-11-02', ganancia_usd: 5, total_cobrado: 200 }),
      remesa({ date: '2026-11-01', estado: 'anulada', ganancia_usd: 50, total_cobrado: 999 }),
    ],
    expenses: [gasto('2026-11-01', 8), gasto('2026-11-02', 3, 'ingreso'), gasto('2026-11-02', 100, 'egreso', 'DINERO APARTE')],
  };

  it('suma por día y por unidad, sin dinero aparte', () => {
    expect(gananciaPorDia(f, '2026-11-01', '2026-11-02')).toEqual([
      { date: '2026-11-01', detal: 10, mayor: 30, remesas: 0, ingresos: 0, gastos: 8, neta: 32 },
      { date: '2026-11-02', detal: 0, mayor: 20, remesas: 5, ingresos: 3, gastos: 0, neta: 28 },
    ]);
  });

  it('resumen del período con volumen, operaciones y margen', () => {
    const r = resumenPeriodo(f, '2026-11-01', '2026-11-02');
    expect(r).toMatchObject({ neta: 60, bruta: 65, gastos: 8, operaciones: 4, volumen: 2200, gastosCount: 1 });
    expect(r.margen).toBeCloseTo(2.95, 2);
    expect(variacion(60, 50)).toBe(20);
    expect(variacion(60, 0)).toBeNull();
  });

  it('mejores clientes por ganancia con lo que deben', () => {
    const top = topClientes(f, [{ id: '1', client_name: 'Ana', current_debt: 40 }], '2026-11-01', '2026-11-02');
    expect(top[0]).toEqual({ name: 'ANA', operaciones: 2, volumen: 1600, ganancia: 50, debe: 40 });
    expect(top[1].name).toBe('LUIS');
  });

  it('remesas del período', () => {
    const r = resumenRemesas(
      [...f.remesas, remesa({ date: '2026-11-02', estado: 'cobrada', pais_pago: 'Colombia', total_cobrado: 100 })],
      '2026-11-01',
      '2026-11-02'
    );
    expect(r).toMatchObject({ enviadas: 2, pendientes: 1, montoUsd: 300, ganancia: 5 });
  });
});

describe('dashboard: liquidez y cuadre', () => {
  it('convierte saldos a USD y deja sin USD las monedas sin tasa', () => {
    const accounts = [
      { id: 'a', currency: 'USD', current_balance: 100, is_active: true },
      { id: 'b', currency: 'VES', current_balance: 2000, is_active: true },
      { id: 'c', currency: 'CLP', current_balance: 5, is_active: true },
      { id: 'd', currency: 'USD', current_balance: 999, is_active: false },
    ] as Account[];
    const l = liquidezPorMoneda(accounts, (c) => (c === 'USD' ? 1 : c === 'VES' ? 200 : null));
    expect(l).toEqual([
      { code: 'USD', local: 100, usd: 100, cuentas: 1 },
      { code: 'VES', local: 2000, usd: 10, cuentas: 1 },
      { code: 'CLP', local: 5, usd: null, cuentas: 1 },
    ]);
  });

  it('usa el último reporte de cada día', () => {
    const rep = (date: string, created_at: string, cuadra: boolean, dif = 0) =>
      ({ date, created_at, cuadra, cuadre: [{ account_id: 'x', name: 'Banesco', currency: 'VES', libro: 0, real: dif, diferencia: dif }] }) as unknown as DailyReport;
    const d = cuadreUltimosDias([rep('2026-11-01', '2026-11-01T10:00', false, -5), rep('2026-11-01', '2026-11-01T20:00', true)], '2026-11-02', 3);
    expect(d.map((x) => x.cuadra)).toEqual([null, true, null]);
  });
});
