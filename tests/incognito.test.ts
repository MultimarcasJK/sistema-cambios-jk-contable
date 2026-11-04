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
import { isIncognito, INCOGNITO_NAME } from '@/lib/incognito';

const MODE = 'mayor' as const;
const acc = (id: string, balance: number) =>
  ({ id, name: id, bank_name: id, currency: 'USD', type: 'banco', responsible: '', current_balance: balance,
     initial_balance: balance, is_active: true, created_at: '2026-10-01T00:00:00Z' }) as unknown as Account;
const bal = (id: string) => StorageService.getAccounts(MODE).find((a) => a.id === id)!.current_balance;
const debtOf = (name: string) => StorageService.getDebtors(MODE).find((d) => d.client_name === name)?.current_debt;

function depositoEnDiaCerrado() {
  localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([acc('BANCO', 1000)]));
  // El cliente ANA debe 300 por una venta fiada
  StorageService.addTransactionMayor(
    { date: '2026-10-27', client_name: 'ANA', currency: 'VES', amount_ves: 0, total_to_pay: 300,
      amount_received: 0, payment_status: 'POR_COBRAR', received_account_id: 'POR_COBRAR' } as any,
    MODE
  );
  // Llega un depósito de 300 sin saber de quién es
  const pay = StorageService.addDebtPayment(
    { client_name: INCOGNITO_NAME, amount: 300, date: '2026-10-28', account_id: 'BANCO', currency: 'USD', notes: 'Ref 123' } as any,
    MODE
  );
  StorageService.addClosure({ date: '2026-10-30', total_net_profit: 0 } as any, undefined, undefined, MODE);
  return pay.id;
}

beforeEach(() => {
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
});

describe('depósitos sin identificar (INCÓGNITO)', () => {
  it('reconoce el nombre con o sin tilde', () => {
    expect(isIncognito('incognito')).toBe(true);
    expect(isIncognito(' INCÓGNITO ')).toBe(true);
    expect(isIncognito('ANA')).toBe(false);
  });

  it('el depósito entra a la cuenta y queda a favor de INCÓGNITO', () => {
    depositoEnDiaCerrado();
    expect(bal('BANCO')).toBe(1300);
    expect(debtOf(INCOGNITO_NAME)).toBe(-300);
    expect(debtOf('ANA')).toBe(300);
  });

  it('se pasa al cliente real aunque el día esté cerrado, sin mover la cuenta', () => {
    const id = depositoEnDiaCerrado();
    const updated = StorageService.assignIncognitoPayment(id, 'ana', MODE);
    expect(updated.client_name).toBe('ANA');
    expect(updated.date).toBe('2026-10-28');
    expect(updated.notes).toMatch(/Ref 123 · Depósito sin identificar del 2026-10-28, asignado el/);
    expect(bal('BANCO')).toBe(1300);
    expect(debtOf('ANA')).toBe(0);
    expect(debtOf(INCOGNITO_NAME) || 0).toBe(0);
  });

  it('solo un ADMIN puede pasarlo', () => {
    const id = depositoEnDiaCerrado();
    setActor({ id: 'u2', email: 'op@test', rol: 'OPERADOR' } as any);
    expect(() => StorageService.assignIncognitoPayment(id, 'ANA', MODE)).toThrow(/ADMIN/);
  });

  it('no se puede pasar a INCÓGNITO ni un abono que ya tiene cliente', () => {
    const id = depositoEnDiaCerrado();
    expect(() => StorageService.assignIncognitoPayment(id, 'incognito', MODE)).toThrow();
    StorageService.assignIncognitoPayment(id, 'ANA', MODE);
    expect(() => StorageService.assignIncognitoPayment(id, 'PEDRO', MODE)).toThrow(/ya tiene cliente/);
  });
});
