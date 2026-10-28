import { beforeEach, describe, expect, it, vi } from 'vitest';
import { packClosureMeta, unpackClosureMeta } from '@/lib/client-fee';

// Supabase falso: la tabla de cierres devuelve lo que haya en remote.closures
const remote = vi.hoisted(() => ({ closures: [] as any[] }));
vi.mock('../src/lib/supabase-sync', () => {
  const service: Record<string, any> = {
    async fetchClosures() {
      return remote.closures.map((c) => ({ ...c }));
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

beforeEach(() => {
  localStorage.clear();
  remote.closures = [];
});

describe('desglose del cierre en notes', () => {
  it('ida y vuelta conserva notas y montos', () => {
    const packed = packClosureMeta('todo bien', { profit_detal: 0, profit_mayor: 30.85, extra_income: 0, total_expenses: 25.5 });
    expect(unpackClosureMeta(packed)).toEqual({
      notes: 'todo bien',
      profit_detal: 0,
      profit_mayor: 30.85,
      extra_income: 0,
      total_expenses: 25.5,
      profit_remesas: 0,
    });
  });
});

describe('cierres que vuelven de Supabase', () => {
  it('un cierre sin desglose toma los montos de la copia local y no queda undefined', async () => {
    const c = StorageService.addClosure(
      { date: '2026-10-21', profit_detal: 0, profit_mayor: 30.85, extra_income: 0, total_expenses: 25.5, total_net_profit: 5.35 },
      [],
      [],
      MODE
    );
    // Así llega de fetchClosures cuando la fila no trae la marca
    remote.closures = [{ id: c.id, date: c.date, closed_at: c.closed_at, total_net_profit: 5.35 }];
    await StorageService.syncFromSupabase(MODE);
    const got = StorageService.getClosures(MODE).find((x) => x.id === c.id)!;
    expect(got.profit_mayor).toBe(30.85);
    expect(got.total_expenses).toBe(25.5);
  });

  it('un cierre de otra computadora sin desglose queda en 0', async () => {
    remote.closures = [{ id: 'close-1', date: '2026-10-20', closed_at: '2026-10-21T00:00:00Z', total_net_profit: 4 }];
    await StorageService.syncFromSupabase(MODE);
    const got = StorageService.getClosures(MODE).find((x) => x.id === 'close-1')!;
    expect(got.profit_detal).toBe(0);
    expect(got.total_expenses).toBe(0);
  });
});

describe('cerrar dos veces el mismo día', () => {
  it('el segundo cierre reemplaza al primero y el viejo no vuelve desde Supabase', async () => {
    const base = { date: '2026-10-27', profit_detal: 0, profit_mayor: 0, extra_income: 0, total_expenses: 0, total_net_profit: 0 };
    const first = StorageService.addClosure(base, [], [], MODE);
    await new Promise((r) => setTimeout(r, 5));
    const second = StorageService.addClosure(base, [], [], MODE);
    expect(second.id).not.toBe(first.id);
    // Supabase todavía trae los dos (como si el borrado no hubiera llegado)
    remote.closures = [
      { id: first.id, date: first.date, closed_at: first.closed_at, total_net_profit: 0 },
      { id: second.id, date: second.date, closed_at: second.closed_at, total_net_profit: 0 },
    ];
    await StorageService.syncFromSupabase(MODE);
    const delDia = StorageService.getClosures(MODE).filter((c) => c.date === '2026-10-27');
    expect(delDia.map((c) => c.id)).toEqual([second.id]);
  });
});
