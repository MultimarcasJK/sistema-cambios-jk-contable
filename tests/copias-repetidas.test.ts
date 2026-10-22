import { beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase falso en memoria: solo traspasos y gastos tienen datos
const remote = vi.hoisted(() => ({ transfers: new Map<string, any>(), expenses: new Map<string, any>() }));

vi.mock('../src/lib/supabase-sync', () => {
  const service: Record<string, any> = {
    async fetchTransfers() {
      return Array.from(remote.transfers.values()).map((t) => ({ ...t }));
    },
    async upsertTransfer(t: any) {
      remote.transfers.set(t.id, { ...t });
    },
    async deleteTransfer(id: string) {
      remote.transfers.delete(id);
    },
    async fetchExpenses() {
      return Array.from(remote.expenses.values()).map((e) => ({ ...e }));
    },
    async upsertExpense(e: any) {
      remote.expenses.set(e.id, { ...e });
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
import { setActor } from '@/lib/actor';
import { Account } from '@/types';

const MODE = 'detal' as const;

function cuenta(id: string, saldo: number): Account {
  return {
    id,
    name: id.toUpperCase(),
    currency: 'VES',
    type: 'banco',
    current_balance: saldo,
    initial_balance: 0,
    is_active: true,
  } as Account;
}

beforeEach(() => {
  localStorage.clear();
  remote.transfers.clear();
  remote.expenses.clear();
  setActor({ id: 'u1', email: 'admin@jk', rol: 'ADMIN' } as any);
});

describe('copias repetidas', () => {
  it('quitar una copia repetida no mueve los saldos', async () => {
    StorageService.saveAccounts([cuenta('javier', 45986.9), cuenta('isabel', 111228.21)], MODE);
    const copia = {
      id: 'trf-copia',
      date: '2026-10-21',
      from_account_id: 'javier',
      to_account_id: 'isabel',
      amount_sent: 500000,
      amount_received: 500000,
      commission: 0,
      percentage_fee: 0,
      concept: '',
    };
    localStorage.setItem(StorageService.getTransfersKey(MODE), JSON.stringify([copia]));

    await StorageService.removeDuplicateRecord('traspaso', 'trf-copia', 'copia por sincronización', MODE);

    expect(StorageService.getTransfers(MODE)).toHaveLength(0);
    const saldos = StorageService.getAccounts(MODE).map((a) => a.current_balance);
    expect(saldos).toEqual([45986.9, 111228.21]);
  });

  it('un equipo sin lista de vistos no vuelve a subir registros viejos que ya no están en Supabase', async () => {
    const viejo = {
      id: 'exp-1700000000000',
      date: '2026-10-21',
      type: 'egreso',
      description: 'X',
      amount: 1,
      currency: 'USD',
      created_at: '2026-10-21T15:00:00Z',
    };
    localStorage.setItem(StorageService.getExpensesKey(MODE), JSON.stringify([viejo]));

    await StorageService.syncFromSupabase(MODE);

    expect(remote.expenses.has('exp-1700000000000')).toBe(false);
    expect(StorageService.getExpenses(MODE)).toHaveLength(0);
  });
});
