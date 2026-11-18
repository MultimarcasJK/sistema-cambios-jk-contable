import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase falso: devuelve como máximo 1000 filas por consulta, como el real
const state = vi.hoisted(() => ({ rows: [] as any[], calls: [] as Array<[number, number]>, failAt: -1 }));

vi.mock('../src/lib/supabase', () => {
  const makeQuery = () => {
    const q: any = {
      select: () => q,
      order: () => q,
      range: async (from: number, to: number) => {
        state.calls.push([from, to]);
        if (state.failAt === from) return { data: null, error: { message: 'falló' } };
        const limit = Math.min(to - from + 1, 1000);
        return { data: state.rows.slice(from, from + limit), error: null };
      },
    };
    return q;
  };
  return { isSupabaseConfigured: true, supabase: { from: () => makeQuery() } };
});

import { SupabaseSyncService, selectAllRows } from '../src/lib/supabase-sync';

const abono = (i: number) => ({
  id: 'pay-' + String(i).padStart(5, '0'),
  date: '2026-09-01',
  client_name: 'CLIENTE ' + (i % 50),
  amount: 10,
});

describe('Descarga completa desde Supabase (más de 1000 filas)', () => {
  beforeEach(() => {
    state.rows = [];
    state.calls = [];
    state.failAt = -1;
  });

  it('trae todas las filas en varias páginas', async () => {
    state.rows = Array.from({ length: 2350 }, (_, i) => abono(i));
    const { data, error } = await selectAllRows('detal_abonos_deudores');
    expect(error).toBeNull();
    expect(data).toHaveLength(2350);
    expect(state.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('los abonos viejos (más allá de los primeros 1000) ya no se pierden', async () => {
    state.rows = Array.from({ length: 1500 }, (_, i) => abono(i));
    const pagos = await SupabaseSyncService.fetchDebtPayments('detal');
    expect(pagos).toHaveLength(1500);
    expect(pagos!.some((p) => p.id === 'pay-01499')).toBe(true);
  });

  it('con exactamente 1000 filas pide una página más y termina', async () => {
    state.rows = Array.from({ length: 1000 }, (_, i) => abono(i));
    const { data } = await selectAllRows('detal_abonos_deudores');
    expect(data).toHaveLength(1000);
    expect(state.calls).toHaveLength(2);
  });

  it('si una página falla no devuelve una lista a medias', async () => {
    state.rows = Array.from({ length: 1500 }, (_, i) => abono(i));
    state.failAt = 1000;
    const pagos = await SupabaseSyncService.fetchDebtPayments('detal');
    expect(pagos).toBeNull();
  });
});
