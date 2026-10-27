import { beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase falso: solo la tabla de clientes responde
const remote = vi.hoisted(() => ({ clients: new Map<string, any>() }));
vi.mock('../src/lib/supabase-sync', () => {
  const service: Record<string, any> = {
    async fetchClients() {
      return Array.from(remote.clients.values()).map((c) => ({ ...c }));
    },
    async upsertClient(c: any) {
      remote.clients.set(c.id, { ...c });
    },
    async deleteClient(id: string) {
      remote.clients.delete(id);
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

const MODE = 'mayor' as const;
const nombres = () => StorageService.getClients(MODE).map((c) => c.name);

beforeEach(() => {
  localStorage.clear();
  remote.clients.clear();
});

describe('cliente borrado', () => {
  it('no vuelve a aparecer por tener deuda en Deudores', async () => {
    StorageService.addDebtor({ client_name: 'JULIO', current_debt: 20 }, MODE);
    const julio = StorageService.getClients(MODE).find((c) => c.name === 'JULIO')!;
    expect(julio).toBeTruthy();

    await StorageService.deleteClient(julio.id, MODE);
    StorageService.syncDebtors(MODE);
    await StorageService.syncFromSupabase(MODE);
    StorageService.syncDebtors(MODE);
    expect(nombres()).not.toContain('JULIO');
  });

  it('otro equipo tampoco lo trae de vuelta con otro id', async () => {
    StorageService.addClient({ name: 'JULIO' }, MODE);
    remote.clients.set('cli-2', { id: 'cli-2', name: 'ANA' });
    await StorageService.deleteClient(StorageService.getClients(MODE).find((c) => c.name === 'JULIO')!.id, MODE);

    // Otro equipo (sin saber del borrado en su memoria) sube una copia nueva
    remote.clients.set('cli-otro', { id: 'cli-otro', name: 'JULIO' });
    // Un equipo nuevo que solo conoce Supabase tampoco lo muestra
    localStorage.clear();
    await StorageService.syncFromSupabase(MODE);
    expect(nombres()).toEqual(['ANA']);
    expect(remote.clients.has('cli-otro')).toBe(false);
    // y su sincronización de Deudores no lo crea
    StorageService.syncDebtors(MODE);
    expect(nombres()).toEqual(['ANA']);
  });

  it('si se registra de nuevo a mano, vuelve en todos lados', async () => {
    StorageService.addClient({ name: 'JULIO' }, MODE);
    await StorageService.deleteClient(StorageService.getClients(MODE)[0].id, MODE);
    StorageService.addClient({ name: 'Julio' }, MODE);
    expect(nombres()).toEqual(['Julio']);

    await StorageService.syncFromSupabase(MODE);
    expect(nombres()).toEqual(['Julio']);
  });
});
