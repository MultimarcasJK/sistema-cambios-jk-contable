import { beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase falso en memoria: solo la tabla de gastos tiene datos
const remote = vi.hoisted(() => ({ expenses: new Map<string, any>(), failUpserts: false }));

vi.mock('../src/lib/supabase-sync', () => {
  const service: Record<string, any> = {
    async fetchExpenses() {
      return Array.from(remote.expenses.values()).map((e) => ({ ...e }));
    },
    async upsertExpense(e: any) {
      if (!remote.failUpserts) remote.expenses.set(e.id, { ...e });
    },
    async deleteExpense(id: string) {
      remote.expenses.delete(id);
    },
  };
  const proxy = new Proxy(service, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop.startsWith('fetch')) return async () => null;
      return async () => true;
    },
  });
  return { SupabaseSyncService: proxy };
});

import { StorageService } from '@/lib/storage';

const MODE = 'detal' as const;
const flush = () => new Promise((r) => setTimeout(r, 0));
const ids = () => StorageService.getExpenses(MODE).map((e) => e.id);

function addExpense(desc: string) {
  return StorageService.addExpense(
    { date: '2026-10-21', type: 'egreso', description: desc, amount: 10, currency: 'USD', concept: 'GASTOS', amount_usd: 10 } as any,
    MODE
  );
}

beforeEach(() => {
  localStorage.clear();
  remote.expenses.clear();
  remote.failUpserts = false;
});

describe('sincronización de gastos', () => {
  it('no resucita un gasto que otra computadora borró', async () => {
    const exp = addExpense('COMISION');
    await flush();
    await StorageService.syncFromSupabase(MODE); // esta computadora lo ve en Supabase
    expect(ids()).toContain(exp.id);

    remote.expenses.delete(exp.id); // otra computadora lo borra
    await StorageService.syncFromSupabase(MODE);
    await flush();
    expect(ids()).not.toContain(exp.id);
    expect(remote.expenses.has(exp.id)).toBe(false);
  });

  it('sigue reintentando un gasto que nunca llegó a Supabase', async () => {
    remote.failUpserts = true;
    const exp = addExpense('ALQUILER');
    await StorageService.syncFromSupabase(MODE);
    expect(ids()).toContain(exp.id);

    remote.failUpserts = false;
    await StorageService.syncFromSupabase(MODE);
    await flush();
    expect(remote.expenses.has(exp.id)).toBe(true);
  });
});
