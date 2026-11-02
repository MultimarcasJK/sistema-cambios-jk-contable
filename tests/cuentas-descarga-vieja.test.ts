import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '@/types';

// Supabase falso: la descarga de cuentas espera hasta que la prueba la suelte
const fake = vi.hoisted(() => ({
  remoteAccounts: [] as any[],
  release: null as null | (() => void),
}));
vi.mock('../src/lib/supabase-sync', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'fetchAccounts')
          return async () => {
            const snapshot = fake.remoteAccounts.map((a) => ({ ...a }));
            await new Promise<void>((r) => (fake.release = r));
            return snapshot;
          };
        if (prop === 'upsertAccount')
          return async (a: any) => {
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

import { StorageService } from '@/lib/storage';
import { setActor } from '@/lib/actor';

const MODE = 'mayor' as const;
const acc = (id: string, current: number) =>
  ({ id, name: id, bank_name: id, currency: 'COP', type: 'banco', responsible: 'X', current_balance: current,
     initial_balance: 0, scope: 'mayor', is_active: true, created_at: '2026-10-01T00:00:00Z' }) as unknown as Account;
const get = (id: string) => StorageService.getAccounts(MODE).find((a) => a.id === id)!;
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
  localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([acc('COP1', -113550)]));
  fake.remoteAccounts = [acc('COP1', -113550)];
  fake.release = null;
});

describe('una descarga que empezó antes no borra un movimiento recién anotado', () => {
  it('compra a proveedor anotada mientras se descargaban las cuentas', async () => {
    const sync = StorageService.syncFromSupabase(MODE);
    while (!fake.release) await tick();
    // Se anota la compra (+113.550) y Supabase confirma el saldo nuevo
    StorageService.updateAccountBalance('COP1', 113550, MODE);
    await tick();
    expect(fake.remoteAccounts[0].current_balance).toBe(0);
    // Llega la copia vieja que se había pedido antes de la compra
    fake.release();
    await sync;
    expect(get('COP1').current_balance).toBe(0);
    expect(fake.remoteAccounts[0].current_balance).toBe(0);
  });

  it('un cambio de otro equipo sí se toma si no hubo cambio local', async () => {
    fake.remoteAccounts = [acc('COP1', 500)];
    const sync = StorageService.syncFromSupabase(MODE);
    while (!fake.release) await tick();
    fake.release();
    await sync;
    expect(get('COP1').current_balance).toBe(500);
  });
});
