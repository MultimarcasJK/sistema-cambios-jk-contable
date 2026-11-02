import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '@/types';

vi.mock('../src/lib/supabase-sync', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop.startsWith('fetch')) return async () => null;
        return async () => true;
      },
    }
  );
  return { SupabaseSyncService: proxy };
});

import { StorageService } from '@/lib/storage';
import { setActor } from '@/lib/actor';

const MODE = 'mayor' as const;
const acc = (id: string, currency: string, balance: number) =>
  ({ id, name: id, bank_name: id, currency, type: 'banco', responsible: '', current_balance: balance,
     initial_balance: balance, is_active: true, created_at: '2026-10-01T00:00:00Z' }) as unknown as Account;
const bal = (id: string) => StorageService.getAccounts(MODE).find((a) => a.id === id)!.current_balance;
const debt = (name: string) => StorageService.getDebtors(MODE).find((d) => d.client_name === name)?.current_debt ?? 0;

// Venta fiada de COP 4.404.000 (compra 3110) anotada con venta a 2020 en vez de 3020
function ventaMalAnotada(cerrar: boolean) {
  localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([acc('COP1', 'COP', 10000000)]));
  const ves = 4404000;
  const tx = StorageService.addTransactionMayor(
    { date: '2026-10-29', client_name: 'EDWARD', currency: 'COP', amount_ves: ves, buy_price: 3110, sell_price: 2020,
      total_to_pay: Number((ves / 2020).toFixed(2)), profit_usd: Number((ves / 2020 - ves / 3110).toFixed(4)),
      commission: 0, amount_received: 0, payment_status: 'PENDIENTE', paid_account_id: 'COP1',
      received_account_id: 'POR_COBRAR' } as any,
    MODE
  );
  if (cerrar) StorageService.addClosure({ date: '2026-10-30', total_net_profit: 0 } as any, undefined, undefined, MODE);
  return tx.id;
}

beforeEach(() => {
  localStorage.clear();
  (globalThis as any).alert = () => {};
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
});

describe('corregir tasas de una venta mayor', () => {
  it('recalcula Debe pagar, ganancia y deuda sin mover cuentas', () => {
    const id = ventaMalAnotada(false);
    expect(debt('EDWARD')).toBe(2180.2);
    const copAntes = bal('COP1');
    const tx = StorageService.changeRatesMayor(id, { sell_price: 3020 }, undefined, MODE)!;
    expect(tx.sell_price).toBe(3020);
    expect(tx.total_to_pay).toBe(1458.28);
    expect(tx.profit_usd).toBeCloseTo(4404000 / 3020 - 4404000 / 3110, 2);
    expect(debt('EDWARD')).toBe(1458.28);
    expect(bal('COP1')).toBe(copAntes);
  });

  it('día cerrado: sin motivo bloquea, con motivo corrige y no toca el cierre', () => {
    const id = ventaMalAnotada(true);
    expect(() => StorageService.changeRatesMayor(id, { sell_price: 3020 }, undefined, MODE)).toThrow(/cerrado/);
    expect(StorageService.getTransactionsMayor(MODE)[0].sell_price).toBe(2020);
    const cierre = JSON.stringify(StorageService.getClosures(MODE));
    StorageService.changeRatesMayor(id, { sell_price: 3020 }, 'tasa mal anotada', MODE);
    expect(StorageService.getTransactionsMayor(MODE)[0].total_to_pay).toBe(1458.28);
    expect(debt('EDWARD')).toBe(1458.28);
    expect(JSON.stringify(StorageService.getClosures(MODE))).toBe(cierre);
  });

  it('solo ADMIN', () => {
    const id = ventaMalAnotada(false);
    setActor({ id: 'u2', email: 'op@test', rol: 'OPERADOR' });
    expect(() => StorageService.changeRatesMayor(id, { sell_price: 3020 }, 'x', MODE)).toThrow(/ADMIN/);
  });

  it('tasa de compra: solo cambia la ganancia, no Debe pagar ni la deuda', () => {
    const id = ventaMalAnotada(false);
    const antes = StorageService.getTransactionsMayor(MODE)[0];
    const tx = StorageService.changeRatesMayor(id, { buy_price: 3000 }, undefined, MODE)!;
    expect(tx.buy_price).toBe(3000);
    expect(tx.total_to_pay).toBe(antes.total_to_pay);
    expect(tx.profit_usd).toBeCloseTo(4404000 / 2020 - 4404000 / 3000, 2);
    expect(debt('EDWARD')).toBe(2180.2);
  });

  it('día cerrado: tasa de compra también pide motivo', () => {
    const id = ventaMalAnotada(true);
    expect(() => StorageService.changeRatesMayor(id, { buy_price: 3000 }, undefined, MODE)).toThrow(/cerrado/);
    StorageService.changeRatesMayor(id, { buy_price: 3000 }, 'costo mal anotado', MODE);
    expect(StorageService.getTransactionsMayor(MODE)[0].buy_price).toBe(3000);
  });

  it('día cerrado: cambiar la cuenta de salida con motivo (ADMIN) mueve el saldo', () => {
    const id = ventaMalAnotada(true);
    const cuentas = StorageService.getAccounts(MODE);
    localStorage.setItem(
      StorageService.getAccountsKey(MODE),
      JSON.stringify([...cuentas, acc('COP2', 'COP', 0)])
    );
    expect(() => StorageService.editTransactionMayor(id, { paid_account_id: 'COP2' }, MODE)).toThrow(/cerrado/);
    StorageService.editTransactionMayor(id, { paid_account_id: 'COP2' }, MODE, 'cuenta equivocada');
    expect(bal('COP2')).toBe(-4404000);
    expect(bal('COP1')).toBe(10000000);
  });
});
