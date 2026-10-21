import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase falso en memoria: solo la tabla de abonos tiene datos, el resto devuelve null
const remote = vi.hoisted(() => ({
  payments: new Map<string, any>(),
  failUpserts: false,
}));

vi.mock('../src/lib/supabase-sync', () => {
  const service: Record<string, any> = {
    async fetchDebtPayments() {
      return Array.from(remote.payments.values()).map((p) => ({ ...p }));
    },
    async upsertDebtPayment(p: any) {
      if (remote.failUpserts) return false;
      remote.payments.set(p.id, { ...p });
      return true;
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
let clock = new Date('2026-10-01T12:00:00.000Z').getTime();
const tick = (ms = 1000) => {
  clock += ms;
  vi.setSystemTime(clock);
};
const flush = () => new Promise((r) => setTimeout(r, 0));

function addPayment(name: string, amount: number) {
  return StorageService.addDebtPayment(
    { client_name: name, amount, date: new Date().toISOString().slice(0, 10) } as any,
    MODE
  );
}
const ids = () => StorageService.getDebtPayments(MODE).map((p) => p.id);

beforeEach(() => {
  localStorage.clear();
  remote.payments.clear();
  remote.failUpserts = false;
  vi.useFakeTimers({ toFake: ['Date'] });
  tick();
  StorageService.getDebtors(MODE);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sincronización de abonos', () => {
  it('no desaparece si Supabase rechazó el guardado', async () => {
    remote.failUpserts = true;
    const pay = addPayment('CARLOS', 20);
    await flush();
    await StorageService.syncFromSupabase(MODE);
    expect(ids()).toContain(pay.id);

    // Cuando Supabase vuelve a aceptar, la sincronización lo reenvía
    remote.failUpserts = false;
    await StorageService.syncFromSupabase(MODE);
    await flush();
    expect(remote.payments.has(pay.id)).toBe(true);
  });

  it('no desaparece si la sincronización trae la lista antes de que llegue a Supabase', async () => {
    remote.failUpserts = true;
    const pay = addPayment('ANA', 10);
    await StorageService.syncFromSupabase(MODE);
    expect(ids()).toContain(pay.id);
  });

  it('un abono ya confirmado y borrado desde otro dispositivo no resucita', async () => {
    const pay = addPayment('LUIS', 15);
    await flush();
    expect(remote.payments.has(pay.id)).toBe(true);
    await StorageService.syncFromSupabase(MODE);

    remote.payments.delete(pay.id);
    await StorageService.syncFromSupabase(MODE);
    await flush();
    expect(ids()).not.toContain(pay.id);
    expect(remote.payments.has(pay.id)).toBe(false);
  });
});
