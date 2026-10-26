import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Debtor, TransactionDetal } from '@/types';

// Supabase falso en memoria: solo la tabla de deudores tiene datos, el resto devuelve null
// (igual que cuando una tabla no responde), así syncFromSupabase no toca otros módulos.
const remote = vi.hoisted(() => ({
  debtors: new Map<string, any>(),
  failDeletes: false,
  failUpserts: false,
  deleteCalls: [] as Array<{ id: string; name?: string }>,
}));

vi.mock('../src/lib/supabase-sync', () => {
  const service: Record<string, any> = {
    async fetchDebtors() {
      return Array.from(remote.debtors.values()).map((d) => ({ ...d }));
    },
    async upsertDebtor(d: Debtor) {
      if (remote.failUpserts) return false;
      remote.debtors.set(d.id, { ...d });
      return true;
    },
    async deleteDebtor(id: string, _mode: string, name?: string) {
      remote.deleteCalls.push({ id, name });
      if (remote.failDeletes) return false;
      remote.debtors.delete(id);
      if (name) {
        for (const [k, v] of Array.from(remote.debtors.entries())) {
          if ((v.client_name || '').trim().toUpperCase() === name.trim().toUpperCase()) remote.debtors.delete(k);
        }
      }
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

function addCreditSale(name: string, amount: number) {
  const key = StorageService.getTransactionsDetalKey(MODE);
  const all = JSON.parse(localStorage.getItem(key) || '[]') as TransactionDetal[];
  all.unshift({
    id: 'detal-' + Date.now(),
    client_name: name,
    total_to_pay: amount,
    payment_status: 'PENDIENTE',
    created_at: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
  } as unknown as TransactionDetal);
  localStorage.setItem(key, JSON.stringify(all));
}

const names = () => StorageService.getDebtors(MODE).map((d) => d.client_name);

beforeEach(() => {
  localStorage.clear();
  remote.debtors.clear();
  remote.failDeletes = false;
  remote.failUpserts = false;
  remote.deleteCalls.length = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  tick();
  StorageService.getDebtors(MODE); // ejecuta las migraciones de una sola vez
});

afterEach(() => {
  vi.useRealTimers();
});

describe('borrado de deudores', () => {
  it('no se recrea a partir de ventas a crédito anteriores al borrado', async () => {
    addCreditSale('CARLOS', 50);
    tick();
    const carlos = StorageService.getDebtors(MODE).find((d) => d.client_name === 'CARLOS');
    expect(carlos?.current_debt).toBe(50);

    tick();
    await StorageService.deleteDebtor(carlos!.id, MODE, carlos!.client_name);
    tick();
    expect(names()).not.toContain('CARLOS');
    // Varias lecturas seguidas (cada una recalcula deudas) no deben traerlo de vuelta
    expect(names()).not.toContain('CARLOS');
  });

  it('vuelve a aparecer si hay una venta nueva después del borrado', async () => {
    addCreditSale('CARLOS', 50);
    tick();
    const carlos = StorageService.getDebtors(MODE).find((d) => d.client_name === 'CARLOS')!;
    tick();
    await StorageService.deleteDebtor(carlos.id, MODE, carlos.client_name);
    tick();
    addCreditSale('CARLOS', 20);
    tick();
    expect(names()).toContain('CARLOS');
  });

  it('se puede volver a registrar a mano un deudor borrado', async () => {
    const ana = StorageService.addDebtor({ client_name: 'Ana', current_debt: 10 }, MODE);
    tick();
    await StorageService.deleteDebtor(ana.id, MODE, ana.client_name);
    tick();
    StorageService.addDebtor({ client_name: 'Ana', current_debt: 5 }, MODE);
    tick();
    expect(names()).toContain('ANA');
  });

  it('una descarga de Supabase iniciada antes del borrado no lo resucita', async () => {
    const ana = StorageService.addDebtor({ client_name: 'Ana', current_debt: 10 }, MODE);
    await Promise.resolve();
    tick();
    expect(remote.debtors.has(ana.id)).toBe(true);

    // Supabase devuelve la fila "vieja" (como si la consulta hubiera salido antes del borrado)
    const staleRow = { ...remote.debtors.get(ana.id) };
    await StorageService.deleteDebtor(ana.id, MODE, ana.client_name);
    tick();
    remote.debtors.set(staleRow.id, staleRow);

    await StorageService.syncFromSupabase(MODE);
    tick();
    expect(names()).not.toContain('ANA');
    // y se vuelve a borrar en Supabase para que los demás dispositivos tampoco la vean
    await vi.waitFor(() => expect(remote.debtors.has(ana.id)).toBe(false));
  });

  it('si Supabase falla al borrar, el borrado se reintenta en la siguiente sincronización', async () => {
    const ana = StorageService.addDebtor({ client_name: 'Ana', current_debt: 10 }, MODE);
    await Promise.resolve();
    tick();

    remote.failDeletes = true;
    await StorageService.deleteDebtor(ana.id, MODE, ana.client_name);
    tick();
    expect(remote.debtors.has(ana.id)).toBe(true);
    expect(names()).not.toContain('ANA');

    await StorageService.syncFromSupabase(MODE);
    tick();
    expect(names()).not.toContain('ANA');

    remote.failDeletes = false;
    await StorageService.syncFromSupabase(MODE);
    tick();
    expect(remote.debtors.has(ana.id)).toBe(false);
    expect(names()).not.toContain('ANA');
  });

  it('el borrado no se pierde aunque se borren más de 500 registros de otros módulos', async () => {
    const ana = StorageService.addDebtor({ client_name: 'Ana', current_debt: 10 }, MODE);
    await Promise.resolve();
    tick();
    remote.failDeletes = true;
    await StorageService.deleteDebtor(ana.id, MODE, ana.client_name);
    tick();

    for (let i = 0; i < 600; i++) {
      await StorageService.deleteExpense('exp-' + i, MODE);
    }
    await StorageService.syncFromSupabase(MODE);
    tick();
    expect(names()).not.toContain('ANA');
  });
});

describe('sincronización con Supabase', () => {
  it('no pierde un deudor nuevo cuya subida falló', async () => {
    remote.failUpserts = true;
    StorageService.addDebtor({ client_name: 'Pedro', current_debt: 30 }, MODE);
    tick();
    await StorageService.syncFromSupabase(MODE);
    tick();
    expect(names()).toContain('PEDRO');

    remote.failUpserts = false;
    await StorageService.syncFromSupabase(MODE);
    tick();
    expect(Array.from(remote.debtors.values()).map((d) => d.client_name)).toContain('PEDRO');
    expect(names()).toContain('PEDRO');
  });

  it('refleja los borrados hechos desde otro dispositivo', async () => {
    remote.debtors.set('deb-otro', { id: 'deb-otro', client_name: 'LUIS', current_debt: 5, updated_at: new Date().toISOString() });
    await StorageService.syncFromSupabase(MODE);
    tick(20000);
    expect(names()).toContain('LUIS');
    await new Promise((r) => setTimeout(r, 0)); // deja terminar la subida pendiente


    remote.debtors.delete('deb-otro');
    await StorageService.syncFromSupabase(MODE);
    tick();
    expect(names()).not.toContain('LUIS');
  });
});

describe('deuda anotada a mano', () => {
  const debtOf = (name: string) =>
    StorageService.getDebtors(MODE).find((d) => d.client_name === name)?.current_debt;

  it('no se borra al recalcular si el cliente ya tiene ventas a crédito', () => {
    addCreditSale('NEUDY', 30);
    tick();
    expect(debtOf('NEUDY')).toBe(30);
    StorageService.addManualDebt({ client_name: 'Neudy', amount: 100 }, MODE);
    tick();
    expect(debtOf('NEUDY')).toBe(130);
    // Lecturas siguientes (recalculan) la mantienen
    expect(debtOf('NEUDY')).toBe(130);
    addCreditSale('NEUDY', 20);
    tick();
    expect(debtOf('NEUDY')).toBe(150);
  });

  it('se acumula si se anota dos veces y se descuenta con abonos', () => {
    StorageService.addManualDebt({ client_name: 'Neudy', amount: 100 }, MODE);
    tick();
    StorageService.addManualDebt({ client_name: 'Neudy', amount: 50 }, MODE);
    tick();
    expect(debtOf('NEUDY')).toBe(150);
    StorageService.addDebtPayment(
      { debtor_id: '', client_name: 'NEUDY', date: '2026-10-01', amount: 40 } as any,
      MODE
    );
    tick();
    expect(debtOf('NEUDY')).toBe(110);
    expect(debtOf('NEUDY')).toBe(110);
  });

  it('una deuda vieja sin marca no se pierde con la primera venta (caso CAROLINA)', async () => {
    // Deudor anotado a mano antes de que existiera la marca [MANUAL]
    localStorage.setItem(
      StorageService.getDebtorsKey(MODE),
      JSON.stringify([{ id: 'deb-1700000000000', client_name: 'CAROLINA', current_debt: 1050, notes: 'Debe de antes', updated_at: '2026-10-01T00:00:00.000Z' }])
    );
    tick();
    expect(debtOf('CAROLINA')).toBe(1050);
    addCreditSale('CAROLINA', 23.38);
    tick();
    expect(debtOf('CAROLINA')).toBe(1073.38);
    expect(debtOf('CAROLINA')).toBe(1073.38);
    await new Promise((r) => setTimeout(r, 0));
    // La marca viaja a Supabase para que otros equipos tampoco la pierdan
    const row = Array.from(remote.debtors.values()).find((d) => d.client_name === 'CAROLINA');
    expect(row?.notes).toContain('[MANUAL:');
  });

  it('una deuda vieja sin marca se descuenta con abonos en vez de quedar negativa', () => {
    localStorage.setItem(
      StorageService.getDebtorsKey(MODE),
      JSON.stringify([{ id: 'deb-1700000000001', client_name: 'ROSA', current_debt: 500, updated_at: '2026-10-01T00:00:00.000Z' }])
    );
    tick();
    expect(debtOf('ROSA')).toBe(500);
    StorageService.addDebtPayment(
      { debtor_id: 'deb-1700000000001', client_name: 'ROSA', date: '2026-10-01', amount: 200 } as any,
      MODE
    );
    tick();
    expect(debtOf('ROSA')).toBe(300);
  });
});

describe('historial de la deuda anotada a mano', () => {
  it('guarda cada anotación con su fecha y lee el formato viejo', async () => {
    const { getManualEntries, getManualDebt, withManualEntry } = await import('@/lib/debtor-sync');
    expect(getManualDebt('Debe del sistema viejo [MANUAL:100]')).toBe(100);
    const notes = withManualEntry('Debe del sistema viejo [MANUAL:100]', 50, '2026-10-24T18:00:00.000Z');
    expect(getManualEntries(notes)).toEqual([
      { at: undefined, amount: 100 },
      { at: '2026-10-24T18:00:00.000Z', amount: 50 },
    ]);
    expect(getManualDebt(notes)).toBe(150);

    StorageService.addManualDebt({ client_name: 'Neudy', amount: 80, notes: 'Sistema viejo' }, MODE);
    tick();
    const d = StorageService.getDebtors(MODE).find((x) => x.client_name === 'NEUDY')!;
    expect(getManualEntries(d.notes)).toHaveLength(1);
    expect(getManualEntries(d.notes)[0].at).toBeTruthy();
  });
});

describe('teléfonos que repiten el nombre', () => {
  it('no se muestran en clientes ni en deudores', () => {
    localStorage.setItem(
      StorageService.getClientsKey(MODE),
      JSON.stringify([
        { id: 'c1', name: 'ALI UZ', phone: 'ALI UZ' },
        { id: 'c2', name: 'ANA', phone: '0414-1234567' },
      ])
    );
    const clients = StorageService.getClients(MODE);
    expect(clients.find((c) => c.id === 'c1')?.phone).toBe('');
    expect(clients.find((c) => c.id === 'c2')?.phone).toBe('0414-1234567');

    StorageService.addDebtor({ client_name: 'Pedro', current_debt: 5, phone: 'pedro ' }, MODE);
    tick();
    expect(StorageService.getDebtors(MODE).find((d) => d.client_name === 'PEDRO')?.phone).toBeUndefined();
  });
});
