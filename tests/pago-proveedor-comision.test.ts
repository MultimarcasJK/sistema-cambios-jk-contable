import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { localDateStr } from '@/lib/dates';

const MODE = 'mayor' as const;

describe('comisión en pagos a proveedores', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setup() {
    StorageService.addAccount(
      {
        id: 'acc-binance',
        name: 'Binance',
        bank_name: 'Binance',
        currency: 'USDT',
        type: 'wallet',
        responsible: 'JK',
        current_balance: 1000,
      } as any,
      MODE
    );
    return StorageService.addSupplier(
      { name: 'Proveedor X', type: 'USDT', contact_info: '', current_debt_usd: 500 } as any,
      MODE
    );
  }

  it('la comisión sale de la cuenta y queda como gasto sin bajar más la deuda', () => {
    const sup = setup();
    const pay = StorageService.addSupplierPayment(
      {
        date: localDateStr(),
        supplier_id: sup.id,
        supplier_name: sup.name,
        amount_usd: 200,
        account_id: 'acc-binance',
        reference: 'TX1',
        commission_usd: 1.5,
      },
      MODE
    );

    const acc = StorageService.getAccounts(MODE).find((a) => a.id === 'acc-binance')!;
    expect(acc.current_balance).toBeCloseTo(798.5, 6);

    const supNow = StorageService.getSuppliers(MODE).find((s) => s.id === sup.id)!;
    expect(supNow.current_debt_usd).toBeCloseTo(300, 6);

    const exps = StorageService.getExpenses(MODE);
    expect(exps).toHaveLength(1);
    expect(exps[0]).toMatchObject({
      type: 'egreso',
      amount: 1.5,
      amount_usd: 1.5,
      currency: 'USDT',
      concept: 'COMISIONES BANCARIAS',
      account_id: 'acc-binance',
    });
    expect(pay.commission_expense_id).toBe(exps[0].id);
  });

  it('sin comisión no se crea ningún gasto', () => {
    const sup = setup();
    StorageService.addSupplierPayment(
      { date: localDateStr(), supplier_id: sup.id, supplier_name: sup.name, amount_usd: 100, account_id: 'acc-binance' },
      MODE
    );
    expect(StorageService.getExpenses(MODE)).toHaveLength(0);
    expect(StorageService.getAccounts(MODE).find((a) => a.id === 'acc-binance')!.current_balance).toBe(900);
  });
});
