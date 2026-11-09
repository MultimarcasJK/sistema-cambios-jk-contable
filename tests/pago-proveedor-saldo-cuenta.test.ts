import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '@/types';

// Supabase falso: cada guardado de cuenta tarda lo que diga la prueba (para que lleguen desordenados)
const fake = vi.hoisted(() => ({
  remoteAccounts: [] as any[],
  remoteExpenses: [] as any[],
  delays: [] as number[],
  upserts: [] as number[],
}));
vi.mock('../src/lib/supabase-sync', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'fetchAccounts') return async () => fake.remoteAccounts.map((a) => ({ ...a }));
        if (prop === 'fetchExpenses') return async () => fake.remoteExpenses.map((e) => ({ ...e }));
        if (prop === 'upsertAccount')
          return async (a: any) => {
            const wait = fake.delays.shift() ?? 0;
            await new Promise((r) => setTimeout(r, wait));
            fake.upserts.push(a.current_balance);
            fake.remoteAccounts = fake.remoteAccounts.map((r) => (r.id === a.id ? { ...a } : r));
            return true;
          };
        if (prop.startsWith('fetch')) return async () => null;
        return async () => true;
      },
    }
  );
  return { SupabaseSyncService: proxy };
});

import { StorageService, syncPartsForTable } from '@/lib/storage';
import { setActor } from '@/lib/actor';

const MODE = 'mayor' as const;
const TODAY = new Date().toLocaleDateString('en-CA');
const acc = (id: string, balance: number) =>
  ({ id, name: id, bank_name: id, currency: 'USD', type: 'banco', responsible: '', current_balance: balance,
     initial_balance: 0, scope: 'mayor', is_active: true, created_at: '2026-10-01T00:00:00Z' }) as unknown as Account;
const bal = () => StorageService.getAccounts(MODE).find((a) => a.id === 'EFECTIVO')!.current_balance;
const settle = () => new Promise((r) => setTimeout(r, 60));

beforeEach(async () => {
  await new Promise((r) => setTimeout(r, 5));
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
  localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([acc('EFECTIVO', 10000)]));
  localStorage.setItem(
    StorageService.getSuppliersKey(MODE),
    JSON.stringify([{ id: 'sup-1', name: 'MAURICIO', type: 'USDT', current_debt_usd: 0, created_at: '' }])
  );
  fake.remoteAccounts = [acc('EFECTIVO', 10000)];
  fake.remoteExpenses = [];
  fake.delays = [];
  fake.upserts = [];
});

describe('pago a proveedor con comisión: el saldo de la cuenta sí resta', () => {
  it('aunque el guardado de la comisión tarde más que el del pago, Supabase queda con el saldo final', async () => {
    fake.delays = [30, 0]; // el primero (comisión) llega tarde
    StorageService.addSupplierPayment(
      { date: TODAY, supplier_id: 'sup-1', supplier_name: 'MAURICIO', amount_usd: 5000, account_id: 'EFECTIVO', commission_usd: 10 } as any,
      MODE
    );
    expect(bal()).toBe(4990);
    await settle();
    expect(fake.remoteAccounts[0].current_balance).toBe(4990);
    // Y una descarga después no lo devuelve al valor viejo
    await StorageService.syncTableFromSupabase(['mayor_cuentas', 'mayor_gastos_ingresos', 'mayor_pagos_proveedores'], MODE);
    expect(bal()).toBe(4990);
  });

  it('la descarga de una sola tabla no pisa un saldo que cambió aquí mientras descargaba', async () => {
    fake.delays = [30];
    StorageService.updateAccountBalance('EFECTIVO', -5000, MODE);
    // Supabase todavía tiene 10000 (el guardado no ha llegado)
    await StorageService.syncTableFromSupabase('mayor_cuentas', MODE);
    expect(bal()).toBe(5000);
    await settle();
    expect(fake.remoteAccounts[0].current_balance).toBe(5000);
  });

  it('la descarga de gastos no borra un gasto recién anotado que aún no sube', async () => {
    StorageService.addExpense(
      { date: TODAY, type: 'egreso', description: 'X', amount: 10, currency: 'USD', concept: 'OTROS', amount_usd: 10 } as any,
      MODE
    );
    await StorageService.syncTableFromSupabase('mayor_gastos_ingresos', MODE);
    expect(StorageService.getExpenses(MODE).filter((e) => e.description === 'X')).toHaveLength(1);
  });

  it('cada tabla sabe qué más tiene que traer', () => {
    expect(syncPartsForTable('mayor_pagos_proveedores')).toEqual(
      expect.arrayContaining(['SupplierPayments', 'Accounts', 'Expenses', 'Suppliers'])
    );
    expect(syncPartsForTable('detal_gastos_fijos')).toEqual(['GastosFijos']);
    expect(syncPartsForTable('mayor_tabla_rara')).toBeNull();
  });
});
