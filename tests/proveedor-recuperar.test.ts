import { beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase falso: proveedores, compras y pagos viven aquí
const fake = vi.hoisted(() => ({
  remoteSuppliers: [] as any[],
  remotePurchases: [] as any[],
  remotePayments: [] as any[],
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
            fake.remoteSuppliers = [...fake.remoteSuppliers.filter((r) => r.id !== s.id), { ...s }];
            return true;
          };
        if (prop === 'deleteSupplier')
          return async (id: string) => {
            fake.remoteSuppliers = fake.remoteSuppliers.filter((r) => r.id !== id);
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
const sup = { id: 'sup-7', name: 'PEDRO USDT', type: 'USDT', contact_info: 'Binance pedro', current_debt_usd: 300, created_at: '2026-10-01T00:00:00Z' };
const compra = { id: 'c1', date: '2026-11-10', supplier_id: 'sup-7', supplier_name: 'PEDRO USDT', currency: 'USDT', quantity: 500, buy_price: 1, cost_usd: 500, credited_amount: 0, created_at: '2026-11-10T10:00:00Z' };
const pago = { id: 'p1', date: '2026-11-12', supplier_id: 'sup-7', supplier_name: 'PEDRO USDT', amount_usd: 200, created_at: '2026-11-12T10:00:00Z' };

beforeEach(async () => {
  await new Promise((r) => setTimeout(r, 5));
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
  fake.remoteSuppliers = [{ ...sup }];
  fake.remotePurchases = [{ ...compra }];
  fake.remotePayments = [{ ...pago }];
  localStorage.setItem(StorageService.getSuppliersKey(MODE), JSON.stringify([sup]));
  localStorage.setItem(StorageService.getSupplierPurchasesKey(MODE), JSON.stringify([compra]));
  localStorage.setItem(StorageService.getSupplierPaymentsKey(MODE), JSON.stringify([pago]));
});

describe('recuperar un proveedor borrado', () => {
  it('borrar deja el historial y el proveedor aparece en "Recuperar borrados"', async () => {
    await StorageService.deleteSupplier('sup-7', MODE);
    expect(StorageService.getSuppliers(MODE).find((s) => s.id === 'sup-7')).toBeUndefined();
    expect(StorageService.getSupplierPurchases(MODE)).toHaveLength(1);
    const borrados = StorageService.getDeletedSuppliers(MODE);
    expect(borrados).toHaveLength(1);
    expect(borrados[0]).toMatchObject({ id: 'sup-7', name: 'PEDRO USDT', compras: 1, pagos: 1 });
  });

  it('recuperar lo devuelve con el mismo id, sus datos y el saldo del extracto', async () => {
    await StorageService.deleteSupplier('sup-7', MODE);
    const r = StorageService.restoreSupplier({ id: 'sup-7', name: 'PEDRO USDT' }, MODE);
    expect(r.id).toBe('sup-7');
    expect(r.contact_info).toBe('Binance pedro');
    expect(r.type).toBe('USDT');
    expect(r.current_debt_usd).toBe(300);
    expect(StorageService.getDeletedSuppliers(MODE)).toHaveLength(0);
    expect(fake.remoteSuppliers.some((s) => s.id === 'sup-7')).toBe(true);
  });

  it('el equipo que lo borró no lo vuelve a borrar al sincronizar si se recuperó en otro', async () => {
    // Este equipo lo borró (queda marcado como borrado aquí)
    await StorageService.deleteSupplier('sup-7', MODE);
    // Otro equipo lo recupera: en Supabase quedan la ficha y la marca de recuperado
    fake.remoteSuppliers.push({ ...sup });
    fake.remoteSuppliers.push({ id: 'sup-restaurado-sup-7', name: 'PEDRO USDT', contact_info: '', current_debt_usd: 0 });
    await StorageService.syncFromSupabaseAhora(MODE);
    expect(fake.remoteSuppliers.some((s) => s.id === 'sup-7')).toBe(true);
    const ids = StorageService.getSuppliers(MODE).map((s) => s.id);
    expect(ids).toContain('sup-7');
    expect(ids).not.toContain('sup-restaurado-sup-7');
  });

  it('un proveedor recuperado de un borrado viejo (sin bitácora) también vuelve', async () => {
    localStorage.setItem(StorageService.getSuppliersKey(MODE), JSON.stringify([]));
    const borrados = StorageService.getDeletedSuppliers(MODE);
    expect(borrados.map((b) => b.name)).toEqual(['PEDRO USDT']);
    const r = StorageService.restoreSupplier(borrados[0], MODE);
    expect(r.name).toBe('PEDRO USDT');
    expect(r.current_debt_usd).toBe(300);
  });
});
