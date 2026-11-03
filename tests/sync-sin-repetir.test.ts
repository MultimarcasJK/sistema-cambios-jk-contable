import { describe, expect, it, vi } from 'vitest';

// Supabase falso que cuenta cuántas veces se descargan las cuentas
const fake = vi.hoisted(() => ({ descargas: 0 }));
vi.mock('../src/lib/supabase-sync', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'fetchAccounts')
          return async () => {
            fake.descargas++;
            await new Promise((r) => setTimeout(r, 20));
            return [];
          };
        if (prop.startsWith('fetch')) return async () => null;
        return async () => true;
      },
    }
  );
  return { SupabaseSyncService: proxy };
});

import { StorageService } from '@/lib/storage';

describe('no repetir descargas completas de Supabase', () => {
  it('varias sincronizaciones seguidas hacen una descarga y dejan solo una más en cola', async () => {
    localStorage.clear();
    fake.descargas = 0;
    await Promise.all([
      StorageService.syncFromSupabase('detal'),
      StorageService.syncFromSupabase('detal'),
      StorageService.syncFromSupabase('detal'),
      StorageService.syncFromSupabase('detal'),
    ]);
    expect(fake.descargas).toBe(2);
    // Terminado todo, una nueva sincronización vuelve a descargar normalmente
    await StorageService.syncFromSupabase('detal');
    expect(fake.descargas).toBe(3);
  });
});
