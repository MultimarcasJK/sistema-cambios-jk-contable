import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '@/types';

vi.mock('../src/lib/supabase-sync', () => {
  const proxy = new Proxy({}, { get(_t, p: string) { return p.startsWith('fetch') ? async () => null : async () => true; } });
  return { SupabaseSyncService: proxy };
});

import { StorageService } from '@/lib/storage';
import { setActor } from '@/lib/actor';
import { buildLedger } from '@/lib/ledger';

const MODE = 'mayor' as const;
const acc = (id: string, currency: string) =>
  ({ id, name: id, bank_name: id, currency, type: 'banco', responsible: '', current_balance: 0, initial_balance: 0,
     scope: 'mayor', is_active: true, created_at: '2026-10-01T12:00:00Z' }) as unknown as Account;
const bal = (id: string) => StorageService.getAccounts(MODE).find((a) => a.id === id)!;
const today = () => new Date().toISOString().slice(0, 10);

// Los ids usan Date.now(): cada registro en su propio milisegundo, como en el uso real
let clock = new Date('2026-10-23T15:00:00Z').getTime();
const realAddExpense = StorageService.addExpense.bind(StorageService);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
  vi.spyOn(StorageService, 'addExpense').mockImplementation((e: any, m?: any) => {
    clock += 1000;
    vi.setSystemTime(clock);
    return realAddExpense(e, m);
  });
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
  localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([acc('VES1', 'VES'), acc('USD1', 'USD')]));
  localStorage.setItem(StorageService.getAccountsKey('detal'), JSON.stringify([]));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('aperturas y restaurar saldos', () => {
  it('pasa los ingresos APERTURA a saldo inicial sin cambiar el saldo', () => {
    StorageService.addExpense({ date: today(), type: 'ingreso', description: 'APERTURA', concept: 'INGRESO EXTRA',
      amount: 1000, currency: 'VES', account_id: 'VES1', amount_usd: 1 } as any, MODE);
    StorageService.addExpense({ date: today(), type: 'ingreso', description: 'APERTURS', concept: 'INGRESO EXTRA',
      amount: 50, currency: 'USD', account_id: 'USD1', amount_usd: 50 } as any, MODE);
    StorageService.addExpense({ date: today(), type: 'ingreso', description: 'otra cosa', concept: 'X',
      amount: 5, currency: 'USD', account_id: 'USD1', amount_usd: 5 } as any, MODE);
    expect(StorageService.convertAperturaIncomes(MODE)).toBe(2);
    expect(bal('VES1').current_balance).toBe(1000);
    expect(bal('VES1').initial_balance).toBe(1000);
    expect(bal('USD1').current_balance).toBe(55);
    expect(bal('USD1').initial_balance).toBe(50);
    expect(StorageService.getExpenses(MODE)).toHaveLength(1);
    const cuadre = buildLedger(StorageService.getLedgerSources()).cuadre;
    expect(cuadre.every((c) => Math.abs(c.diferencia) < 0.01)).toBe(true);
  });

  it('restaura los saldos pisados a 0 según el libro', () => {
    StorageService.addExpense({ date: today(), type: 'ingreso', description: 'APERTURA', concept: 'INGRESO EXTRA',
      amount: 1000, currency: 'VES', account_id: 'VES1', amount_usd: 1 } as any, MODE);
    StorageService.addTransfer({ date: today(), from_account_id: 'VES1', to_account_id: 'VES1x', amount_sent: 0,
      amount_received: 0 } as any, MODE);
    // Simula el pisado: saldos guardados en 0
    localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([acc('VES1', 'VES'), acc('USD1', 'USD')]));
    const cuadre = buildLedger(StorageService.getLedgerSources()).cuadre.filter((c) => Math.abs(c.diferencia) >= 0.01);
    const n = StorageService.restoreBalancesFromLedger(cuadre.map((c) => ({ accountId: c.account.id, libro: c.libro })), MODE);
    expect(n).toBe(1);
    expect(bal('VES1').current_balance).toBe(1000);
  });
});
