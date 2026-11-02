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
const acc = (id: string, balance: number) =>
  ({ id, name: id, bank_name: id, currency: 'USD', type: 'banco', responsible: '', current_balance: balance,
     initial_balance: balance, is_active: true, created_at: '2026-10-01T00:00:00Z' }) as unknown as Account;
const bal = (id: string) => StorageService.getAccounts(MODE).find((a) => a.id === id)!.current_balance;
const debt = (name: string) => StorageService.getDebtors(MODE).find((d) => d.client_name === name)!.current_debt;

function prepararDiaCerrado() {
  localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([acc('VES1', 0), acc('KELVIN', 1000)]));
  // Venta fiada de 119 y su abono, ambos del 27/10
  StorageService.addTransactionMayor(
    { date: '2026-10-27', client_name: 'ANDRES', currency: 'VES', amount_ves: 0, total_to_pay: 119,
      amount_received: 0, payment_status: 'POR_COBRAR', received_account_id: 'POR_COBRAR' } as any,
    MODE
  );
  const pay = StorageService.addDebtPayment(
    { client_name: 'ANDRES', amount: 119, date: '2026-10-27', account_id: 'KELVIN', currency: 'USD' } as any,
    MODE
  );
  StorageService.addClosure({ date: '2026-10-30', total_net_profit: 5 } as any, undefined, undefined, MODE);
  return pay.id;
}

beforeEach(() => {
  localStorage.clear();
  (globalThis as any).alert = () => {};
});

describe('anular abono en día cerrado', () => {
  it('sin motivo sigue bloqueado', async () => {
    setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
    const id = prepararDiaCerrado();
    await expect(StorageService.deleteDebtPayment(id, MODE)).rejects.toThrow(/cerrado/);
    expect(StorageService.getDebtPayments(MODE)).toHaveLength(1);
    expect(bal('KELVIN')).toBe(1119);
  });

  it('un operador no puede aunque ponga motivo', async () => {
    setActor({ id: 'u2', email: 'op@test', rol: 'OPERADOR' });
    const id = prepararDiaCerrado();
    await expect(StorageService.deleteDebtPayment(id, MODE, 'duplicado')).rejects.toThrow(/cerrado/);
    expect(StorageService.getDebtPayments(MODE)).toHaveLength(1);
  });

  it('ADMIN con motivo: resta a la cuenta, devuelve la deuda y no toca el cierre', async () => {
    setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
    const id = prepararDiaCerrado();
    expect(debt('ANDRES')).toBe(0);
    const cierreAntes = JSON.stringify(StorageService.getClosures(MODE));
    await StorageService.deleteDebtPayment(id, MODE, 'abono duplicado');
    expect(StorageService.getDebtPayments(MODE)).toHaveLength(0);
    expect(bal('KELVIN')).toBe(1000);
    expect(debt('ANDRES')).toBe(119);
    expect(JSON.stringify(StorageService.getClosures(MODE))).toBe(cierreAntes);
  });
});
