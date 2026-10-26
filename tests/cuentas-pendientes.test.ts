import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '@/types';

// Supabase falso: devuelve la copia de cuentas que diga la prueba; guardar responde lo que diga la prueba
const fake = vi.hoisted(() => ({ remoteAccounts: [] as any[], upsertOk: true }));
vi.mock('../src/lib/supabase-sync', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'fetchAccounts') return async () => fake.remoteAccounts.map((a) => ({ ...a }));
        if (prop === 'upsertAccount') return async () => fake.upsertOk;
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
const acc = (id: string, initial: number, current: number) =>
  ({ id, name: id, bank_name: id, currency: 'VES', type: 'banco', responsible: 'X', current_balance: current,
     initial_balance: initial, scope: 'mayor', is_active: true, created_at: '2026-10-01T00:00:00Z' }) as unknown as Account;
const get = (id: string) => StorageService.getAccounts(MODE).find((a) => a.id === id)!;

beforeEach(() => {
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
  localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([acc('VES1', 0, 0)]));
  fake.remoteAccounts = [acc('VES1', 0, 0)];
  fake.upsertOk = true;
});

describe('sincronizar cuentas sin perder lo recién guardado', () => {
  it('si Supabase no confirmó el guardado, la copia vieja no pisa el saldo nuevo', async () => {
    fake.upsertOk = false;
    StorageService.saveAccountEdit({ ...get('VES1'), initial_balance: 13209.25 }, MODE);
    await Promise.resolve();
    await StorageService.syncFromSupabase(MODE);
    expect(get('VES1').initial_balance).toBe(13209.25);
    expect(get('VES1').current_balance).toBe(13209.25);
  });

  it('cuando Supabase ya confirmó, manda la copia de Supabase (cambios de otro equipo)', async () => {
    StorageService.saveAccountEdit({ ...get('VES1'), initial_balance: 100 }, MODE);
    await new Promise((r) => setTimeout(r, 0));
    fake.remoteAccounts = [acc('VES1', 100, 250)];
    await StorageService.syncFromSupabase(MODE);
    expect(get('VES1').current_balance).toBe(250);
  });
});
