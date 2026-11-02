import { beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase falso: la descarga de proveedores espera hasta que la prueba la suelte
const fake = vi.hoisted(() => ({
  remoteSuppliers: [] as any[],
  release: null as null | (() => void),
  upsertOk: true,
}));
vi.mock('../src/lib/supabase-sync', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'fetchSuppliers')
          return async () => {
            const snapshot = fake.remoteSuppliers.map((s) => ({ ...s }));
            await new Promise<void>((r) => (fake.release = r));
            return snapshot;
          };
        if (prop === 'upsertSupplier')
          return async (s: any) => {
            if (!fake.upsertOk) return false;
            fake.remoteSuppliers = fake.remoteSuppliers.map((r) => (r.id === s.id ? { ...s } : r));
            return true;
          };
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
const sup = (debt: number) => ({ id: 'sup-1', name: 'CABALLO', type: 'COP', current_debt_usd: debt, created_at: '2026-10-01T00:00:00Z' });
const get = () => StorageService.getSuppliers(MODE).find((s) => s.id === 'sup-1')!;
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
  localStorage.setItem(StorageService.getSuppliersKey(MODE), JSON.stringify([sup(0)]));
  fake.remoteSuppliers = [sup(0)];
  fake.release = null;
  fake.upsertOk = true;
});

describe('deuda del proveedor', () => {
  it('una descarga vieja no pisa una deuda recién cambiada', async () => {
    const sync = StorageService.syncFromSupabase(MODE);
    while (!fake.release) await tick();
    StorageService.updateSupplierDebt('sup-1', 300, MODE);
    await tick();
    fake.release();
    await sync;
    expect(get().current_debt_usd).toBe(300);
  });

  it('si Supabase no confirmó el guardado, la descarga tampoco la pisa', async () => {
    fake.upsertOk = false;
    StorageService.updateSupplierDebt('sup-1', 41.85, MODE);
    await tick();
    fake.upsertOk = true;
    const sync = StorageService.syncFromSupabase(MODE);
    while (!fake.release) await tick();
    fake.release();
    await sync;
    expect(get().current_debt_usd).toBe(41.85);
    expect(fake.remoteSuppliers[0].current_debt_usd).toBe(41.85);
  });

  it('el extracto muestra la diferencia y el ADMIN puede cuadrarla', () => {
    localStorage.setItem(StorageService.getSuppliersKey(MODE), JSON.stringify([sup(5.69)]));
    localStorage.setItem(
      StorageService.getSupplierPurchasesKey(MODE),
      JSON.stringify([{ id: 'pur-1', date: '2026-11-02', supplier_id: 'sup-1', supplier_name: 'CABALLO', currency: 'COP', quantity: 1, buy_price: 1, cost_usd: 1000, credited_amount: 0, created_at: '' }])
    );
    localStorage.setItem(
      StorageService.getSupplierPaymentsKey(MODE),
      JSON.stringify([{ id: 'pay-1', date: '2026-11-02', supplier_id: 'sup-1', supplier_name: 'CABALLO', amount_usd: 1085.02, created_at: '' }])
    );
    const ledger = StorageService.getSupplierLedger(get(), MODE);
    expect(ledger.extractDebtUsd).toBe(-85.02);
    expect(ledger.differenceUsd).toBe(90.71);
    StorageService.reconcileSupplierDebt('sup-1', 'cuadre', MODE);
    expect(get().current_debt_usd).toBe(-85.02);
  });

  it('solo un ADMIN puede cuadrar', () => {
    setActor({ id: 'u2', email: 'op@test', rol: 'OPERADOR' } as any);
    expect(() => StorageService.reconcileSupplierDebt('sup-1', 'x', MODE)).toThrow();
  });
});
