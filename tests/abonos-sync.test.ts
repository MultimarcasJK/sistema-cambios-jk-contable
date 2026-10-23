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

describe('cambiar cliente de un abono', () => {
  const debtOf = (name: string) =>
    StorageService.getDebtors(MODE).find((d) => d.client_name.toUpperCase() === name)?.current_debt ?? 0;

  it('pasa el abono al cliente correcto sin tocar el monto', async () => {
    const pay = addPayment('LENNYRETH PEREZ', 20);
    tick();
    addPayment('MARIA LOPEZ', 5);
    tick();
    expect(debtOf('LENNYRETH PEREZ')).toBe(-20);

    StorageService.renameDebtPayment(pay.id, ' maria lopez ', MODE);
    await flush();

    expect(debtOf('LENNYRETH PEREZ')).toBe(0);
    expect(debtOf('MARIA LOPEZ')).toBe(-25);
    const saved = StorageService.getDebtPayments(MODE).find((p) => p.id === pay.id)!;
    expect(saved.client_name).toBe('MARIA LOPEZ');
    expect(saved.amount).toBe(20);
    expect(remote.payments.get(pay.id).client_name).toBe('MARIA LOPEZ');
  });

  it('crea el deudor si el nombre nuevo no existe', () => {
    const pay = addPayment('LENNYRETH PEREZ', 15);
    tick();
    StorageService.renameDebtPayment(pay.id, 'ANA ROJAS', MODE);
    expect(debtOf('ANA ROJAS')).toBe(-15);
    expect(debtOf('LENNYRETH PEREZ')).toBe(0);
  });
});

describe('cambiar cliente de una venta', () => {
  const debtOf = (name: string) =>
    StorageService.getDebtors(MODE).find((d) => d.client_name.toUpperCase() === name)?.current_debt ?? 0;
  const today = () => new Date().toISOString().slice(0, 10);

  it('venta mayor fiada: la deuda pasa al cliente nuevo', () => {
    const tx = StorageService.addTransactionMayor(
      { date: today(), client_name: 'PEDRO', amount_ves: 100, total_to_pay: 50, amount_received: 20,
        payment_status: 'PARCIAL', received_account_id: '', paid_account_id: '' } as any,
      MODE
    );
    tick();
    expect(debtOf('PEDRO')).toBe(30);
    StorageService.renameTransactionMayor(tx.id, 'juan', MODE);
    expect(debtOf('PEDRO')).toBe(0);
    expect(debtOf('JUAN')).toBe(30);
    const saved = StorageService.getTransactionsMayor(MODE).find((t) => t.id === tx.id)!;
    expect(saved.client_name).toBe('JUAN');
    expect(saved.amount_ves).toBe(100);
  });

  it('venta detal pagada: solo cambia el nombre', () => {
    const tx = StorageService.addTransactionDetal(
      { date: today(), client_name: 'PEDRO', usdt_amount: 10, total_to_pay: 10, amount_received: 10,
        payment_status: 'PAGADO', received_account_id: '', paid_account_id: '' } as any,
      MODE
    );
    tick();
    StorageService.renameTransactionDetal(tx.id, 'JUAN', MODE);
    expect(StorageService.getTransactionsDetal(MODE)[0].client_name).toBe('JUAN');
    expect(debtOf('JUAN')).toBe(0);
    expect(debtOf('PEDRO')).toBe(0);
  });
});
