import { beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase falso: proveedores, compras y pagos vienen de aquí
const fake = vi.hoisted(() => ({
  remoteSuppliers: [] as any[],
  remotePurchases: [] as any[],
  remotePayments: [] as any[],
  upsertOk: true,
}));
vi.mock('../src/lib/supabase-sync', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'fetchSuppliers') return async () => fake.remoteSuppliers.map((s) => ({ ...s }));
        if (prop === 'fetchSupplierPurchases') return async () => fake.remotePurchases.map((s) => ({ ...s }));
        if (prop === 'fetchSupplierPayments') return async () => fake.remotePayments.map((s) => ({ ...s }));
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
import { resumenProveedores } from '@/lib/dashboard-metrics';

const MODE = 'mayor' as const;
const TODAY = new Date().toLocaleDateString('en-CA');
const sup = (debt: number) => ({ id: 'sup-1', name: 'MAURICIO', type: 'USDT', current_debt_usd: debt, created_at: '2026-10-01T00:00:00Z' });
const compra = (id: string, cost: number) => ({
  id, date: TODAY, supplier_id: 'sup-1', supplier_name: 'MAURICIO', currency: 'USDT',
  quantity: cost, buy_price: 1, cost_usd: cost, credited_amount: 0, created_at: '2026-11-02T10:00:00Z',
});
const pago = (id: string, amount: number) => ({
  id, date: TODAY, supplier_id: 'sup-1', supplier_name: 'MAURICIO', amount_usd: amount, created_at: '2026-11-02T11:00:00Z',
});
const debt = () => StorageService.getSuppliers(MODE).find((s) => s.id === 'sup-1')!.current_debt_usd;

beforeEach(() => {
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
  fake.remoteSuppliers = [sup(0)];
  fake.remotePurchases = [];
  fake.remotePayments = [];
  fake.upsertOk = true;
  localStorage.setItem(StorageService.getSuppliersKey(MODE), JSON.stringify([sup(0)]));
});

describe('la deuda del proveedor sale de su extracto', () => {
  it('un número guardado pisado se corrige solo al sincronizar', async () => {
    // Caso MAURICIO: 15.000 + 15.000 comprados, 18.760 pagados, pero la deuda guardada quedó en 30.000
    fake.remoteSuppliers = [sup(30000)];
    fake.remotePurchases = [compra('pur-1', 15000), compra('pur-2', 15000)];
    fake.remotePayments = [pago('pay-1', 18760)];
    await StorageService.syncFromSupabase(MODE);
    expect(debt()).toBe(11240);
    expect(fake.remoteSuppliers[0].current_debt_usd).toBe(11240);
  });

  it('compras y pagos recalculan la deuda aunque el número guardado estuviera mal', () => {
    localStorage.setItem(StorageService.getSuppliersKey(MODE), JSON.stringify([sup(999)]));
    StorageService.addSupplierPurchase({ ...compra('x', 15000), id: undefined } as any, MODE);
    expect(debt()).toBe(15000);
    StorageService.addSupplierPayment({ ...pago('x', 760), id: undefined } as any, MODE);
    expect(debt()).toBe(14240);
  });

  it('borrar un pago devuelve la deuda', async () => {
    StorageService.addSupplierPurchase({ ...compra('x', 1000), id: undefined } as any, MODE);
    const p = StorageService.addSupplierPayment({ ...pago('x', 400), id: undefined } as any, MODE);
    expect(debt()).toBe(600);
    await StorageService.deleteSupplierPayment(p.id, MODE);
    expect(debt()).toBe(1000);
  });

  it('Editar la deuda deja un ajuste en el extracto que no se pierde', () => {
    StorageService.updateSupplier('sup-1', { current_debt_usd: 500 }, MODE);
    expect(debt()).toBe(500);
    const ajustes = StorageService.getSupplierPurchases(MODE).filter((p) => p.id.startsWith('adj-'));
    expect(ajustes).toHaveLength(1);
    expect(ajustes[0].cost_usd).toBe(500);
    StorageService.addSupplierPurchase({ ...compra('x', 100), id: undefined } as any, MODE);
    expect(debt()).toBe(600);
    // Guardar Editar sin cambiar la deuda no crea otro ajuste
    StorageService.updateSupplier('sup-1', { name: 'MAURICIO', current_debt_usd: 600 }, MODE);
    expect(StorageService.getSupplierPurchases(MODE).filter((p) => p.id.startsWith('adj-'))).toHaveLength(1);
  });

  it('un proveedor nuevo con deuda inicial la guarda como ajuste', () => {
    const s = StorageService.addSupplier({ name: 'NUEVO', type: 'USDT', current_debt_usd: 250 } as any, MODE);
    expect(s.current_debt_usd).toBe(250);
    expect(StorageService.getSupplierLedger(s, MODE).extractDebtUsd).toBe(250);
  });

  it('los ajustes no cuentan como compras en el resumen', () => {
    StorageService.updateSupplier('sup-1', { current_debt_usd: 500 }, MODE);
    const r = resumenProveedores(StorageService.getSupplierPurchases(MODE), [], '2000-01-01', '2100-01-01');
    expect(r.compras).toBe(0);
  });

  it('solo un ADMIN puede cuadrar', () => {
    setActor({ id: 'u2', email: 'op@test', rol: 'OPERADOR' } as any);
    expect(() => StorageService.reconcileSupplierDebt('sup-1', 'x', MODE)).toThrow();
  });
});
