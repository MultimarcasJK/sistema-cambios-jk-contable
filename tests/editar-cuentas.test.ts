import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '@/types';

// Supabase falso: ninguna tabla responde, todo queda local
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
const today = () => new Date().toISOString().slice(0, 10);

beforeEach(() => {
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
  localStorage.setItem(
    StorageService.getAccountsKey(MODE),
    JSON.stringify([acc('VES1', 'VES', 100000), acc('VES2', 'VES', 50000), acc('USD1', 'USD', 1000), acc('USD2', 'USD', 0)])
  );
});

describe('editar cuentas de una venta mayor', () => {
  it('mueve la salida y lo recibido a las cuentas nuevas sin cambiar montos', () => {
    const tx = StorageService.addTransactionMayor(
      { date: today(), client_name: 'PEDRO', currency: 'VES', amount_ves: 10000, total_to_pay: 10,
        amount_received: 10, payment_status: 'PAGADO', paid_account_id: 'VES1', received_account_id: 'USD1',
        commission: 0, profit_usd: 1 } as any,
      MODE
    );
    expect(bal('VES1')).toBe(90000);
    expect(bal('USD1')).toBe(1010);

    StorageService.editTransactionMayor(tx.id, { paid_account_id: 'VES2', received_account_id: 'USD2' }, MODE);

    expect(bal('VES1')).toBe(100000);
    expect(bal('VES2')).toBe(40000);
    expect(bal('USD1')).toBe(1000);
    expect(bal('USD2')).toBe(10);
    const saved = StorageService.getTransactionsMayor(MODE)[0];
    expect(saved.paid_account_id).toBe('VES2');
    expect(saved.amount_ves).toBe(10000);
  });

  it('no deja pasar a una cuenta de otra moneda', () => {
    const tx = StorageService.addTransactionMayor(
      { date: today(), client_name: 'PEDRO', currency: 'VES', amount_ves: 10000, total_to_pay: 10,
        amount_received: 10, payment_status: 'PAGADO', paid_account_id: 'VES1', received_account_id: 'USD1' } as any,
      MODE
    );
    expect(() => StorageService.editTransactionMayor(tx.id, { paid_account_id: 'USD2' }, MODE)).toThrow(/VES/);
    expect(bal('VES1')).toBe(90000);
  });

  it('venta por cobrar: no cambia Recibido Por', () => {
    const tx = StorageService.addTransactionMayor(
      { date: today(), client_name: 'PEDRO', currency: 'VES', amount_ves: 10000, total_to_pay: 10,
        amount_received: 0, payment_status: 'POR_COBRAR', paid_account_id: 'VES1', received_account_id: 'POR_COBRAR' } as any,
      MODE
    );
    expect(() => StorageService.editTransactionMayor(tx.id, { received_account_id: 'USD2' }, MODE)).toThrow(/abono/);
  });
});

describe('editar cuenta de un abono', () => {
  it('mueve lo abonado a la cuenta nueva', () => {
    const pay = StorageService.addDebtPayment(
      { client_name: 'PEDRO', amount: 20, date: today(), account_id: 'USD1' } as any,
      MODE
    );
    expect(bal('USD1')).toBe(1020);
    StorageService.editDebtPayment(pay.id, { account_id: 'USD2', client_name: 'JUAN' }, MODE);
    expect(bal('USD1')).toBe(1000);
    expect(bal('USD2')).toBe(20);
    const saved = StorageService.getDebtPayments(MODE)[0];
    expect(saved.account_id).toBe('USD2');
    expect(saved.client_name).toBe('JUAN');
  });
});

describe('editar saldo inicial de una cuenta', () => {
  it('el saldo actual sube lo mismo que el saldo inicial', () => {
    const a = StorageService.getAccounts(MODE).find((x) => x.id === 'USD2')!;
    StorageService.saveAccountEdit({ ...a, initial_balance: 13209.25, current_balance: 0 }, MODE);
    const saved = StorageService.getAccounts(MODE).find((x) => x.id === 'USD2')!;
    expect(saved.initial_balance).toBe(13209.25);
    expect(saved.current_balance).toBe(13209.25);
  });

  it('respeta las operaciones que ya tenía la cuenta', () => {
    const a = StorageService.getAccounts(MODE).find((x) => x.id === 'VES1')!;
    StorageService.updateAccount('VES1', { current_balance: 90000 }, MODE);
    StorageService.saveAccountEdit({ ...a, initial_balance: 100500, current_balance: 0 }, MODE);
    expect(bal('VES1')).toBe(90500);
  });

  it('si no cambia el saldo inicial, el saldo actual no se toca', () => {
    const a = StorageService.getAccounts(MODE).find((x) => x.id === 'USD1')!;
    StorageService.saveAccountEdit({ ...a, name: 'NUEVO', current_balance: 5 }, MODE);
    expect(bal('USD1')).toBe(1000);
  });
});
