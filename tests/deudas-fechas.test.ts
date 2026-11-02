import { describe, it, expect } from 'vitest';
import { deudasDeCliente, antiguedad, antiguedadCartera } from '@/lib/deudas-fechas';
import { Debtor, DebtPayment, Remesa, TransactionMayor } from '@/types';

const venta = (id: string, date: string, total: number, status: 'PAGADO' | 'PENDIENTE' | 'PARCIAL', received = 0, client = 'ANA'): TransactionMayor =>
  ({
    id,
    date,
    client_name: client,
    amount_ves: 0,
    buy_price: 0,
    sell_price: 0,
    total_to_pay: total,
    amount_received: received,
    commission: 0,
    profit_usd: 0,
    payment_status: status,
    created_at: date + 'T10:00:00Z',
  }) as TransactionMayor;

const abono = (amount: number, client = 'ANA'): DebtPayment => ({ id: 'p' + amount, debtor_id: 'd', client_name: client, date: '2026-10-30', amount });

describe('deudas por fecha', () => {
  it('separa la deuda por venta y los abonos pagan primero la más vieja', () => {
    const mayorTxs = [
      venta('v1', '2026-10-01', 500, 'PENDIENTE'),
      venta('v2', '2026-10-20', 300, 'PARCIAL', 100),
      venta('v3', '2026-10-25', 999, 'PAGADO'),
    ];
    const debtor: Debtor = { id: 'd', client_name: 'Ana', current_debt: 400 };
    const r = deudasDeCliente(debtor, 'Ana', { mayorTxs, payments: [abono(300)] });
    expect(r.items.map((i) => [i.date, i.monto, i.pendiente])).toEqual([
      ['2026-10-01', 500, 200],
      ['2026-10-20', 200, 200],
    ]);
    expect(r.totalPendiente).toBe(400);
    expect(r.abonado).toBe(300);
    expect(r.aFavor).toBe(0);
  });

  it('incluye remesas fiadas (no anuladas) y deudas anotadas a mano con su fecha', () => {
    const remesas = [
      { id: 'r1', numero: 7, date: '2026-10-05', created_at: '2026-10-05T12:00:00Z', remitente_name: 'ana', estado: 'pagada', fiado_usd: 50 },
      { id: 'r2', numero: 8, date: '2026-10-06', created_at: '2026-10-06T12:00:00Z', remitente_name: 'ANA', estado: 'anulada', fiado_usd: 80 },
    ] as unknown as Remesa[];
    const debtor: Debtor = { id: 'd', client_name: 'ANA', current_debt: 150, notes: 'x [MANUAL:2026-09-10T15:00:00.000Z=100]' };
    const r = deudasDeCliente(debtor, 'ANA', { remesas });
    expect(r.items.map((i) => [i.origen, i.date, i.pendiente])).toEqual([
      ['manual', '2026-09-10', 100],
      ['remesa', '2026-10-05', 50],
    ]);
    expect(r.totalPendiente).toBe(150);
  });

  it('un saldo que no sale de las operaciones aparece como saldo anterior sin fecha', () => {
    const debtor: Debtor = { id: 'd', client_name: 'ANA', current_debt: 120 };
    const r = deudasDeCliente(debtor, 'ANA', { mayorTxs: [venta('v1', '2026-10-01', 20, 'PENDIENTE')] });
    expect(r.items[0]).toMatchObject({ origen: 'anterior', date: '', pendiente: 100 });
    expect(r.totalPendiente).toBe(120);
  });

  it('abonos de más quedan como saldo a favor', () => {
    const r = deudasDeCliente(undefined, 'ANA', { mayorTxs: [venta('v1', '2026-10-01', 100, 'PENDIENTE')], payments: [abono(150)] });
    expect(r.totalPendiente).toBe(0);
    expect(r.aFavor).toBe(50);
  });

  it('agrupa lo pendiente por antigüedad', () => {
    const hoy = '2026-11-02';
    const mayorTxs = [
      venta('a', '2026-10-30', 10, 'PENDIENTE', 0, 'ANA'),
      venta('b', '2026-10-15', 20, 'PENDIENTE', 0, 'ANA'),
      venta('c', '2026-09-01', 30, 'PENDIENTE', 0, 'LUIS'),
    ];
    const debtors: Debtor[] = [
      { id: '1', client_name: 'ANA', current_debt: 30 },
      { id: '2', client_name: 'LUIS', current_debt: 35 },
      { id: '3', client_name: 'PEPE', current_debt: -10 },
    ];
    expect(antiguedadCartera(debtors, { mayorTxs }, hoy)).toEqual({ hasta7: 10, hasta30: 20, mas30: 30, sinFecha: 5, total: 65 });
    expect(antiguedad([], hoy).total).toBe(0);
  });
});
