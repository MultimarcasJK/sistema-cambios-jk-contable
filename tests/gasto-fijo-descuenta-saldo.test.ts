import { beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase falso con una sola cuenta. "offline" hace fallar los guardados.
const fake = vi.hoisted(() => ({ remote: [] as any[], offline: false }));
vi.mock('../src/lib/supabase-sync', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'fetchAccounts') return async () => (fake.offline ? null : fake.remote.map((a) => ({ ...a })));
        if (prop === 'upsertAccount')
          return async (a: any) => {
            if (fake.offline) return false;
            fake.remote = fake.remote.map((r) => (r.id === a.id ? { ...a } : r));
            return true;
          };
        if (prop === 'addToAccountBalance')
          return async (id: string, _m: any, delta: number) => {
            if (fake.offline) return null;
            const row = fake.remote.find((r) => r.id === id);
            if (!row) return 'missing';
            row.current_balance = Number((row.current_balance + delta).toFixed(4));
            return row.current_balance;
          };
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
const TODAY = new Date().toLocaleDateString('en-CA');
const banco = { id: 'B1', name: 'BANCO', bank_name: 'B', currency: 'USD', type: 'banco', responsible: '', current_balance: 1000,
  initial_balance: 1000, is_active: true, created_at: '2026-10-01T00:00:00Z' };
const local = () => StorageService.getAccounts(MODE)[0].current_balance;
const remote = () => fake.remote[0].current_balance;
const settle = () => new Promise((r) => setTimeout(r, 20));
const pagarGastoFijo = (monto: number) =>
  StorageService.addServiceExpense(
    { date: TODAY, category: 'OTROS' as any, description: 'Alquiler de cuenta', amount: monto, currency: 'USD',
      exchange_rate: 1, amount_usd: monto, account_id: 'B1', notes: '[gf:fijo-1]' } as any,
    MODE
  );
// Otro equipo que tenía la cuenta con un saldo viejo (no ha descargado)
const comoOtroEquipoConSaldoViejo = (saldoViejo: number) => {
  localStorage.clear();
  setActor({ id: 'u2', email: 'cajero@test', rol: 'ADMIN' });
  localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([{ ...banco, current_balance: saldoViejo }]));
};

beforeEach(async () => {
  await settle();
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
  localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([{ ...banco }]));
  fake.remote = [{ ...banco }];
  fake.offline = false;
});

describe('pago de gasto fijo: se descuenta del banco y no se pierde', () => {
  it('descuenta aquí y en Supabase, y una descarga no lo devuelve', async () => {
    pagarGastoFijo(100);
    expect(local()).toBe(900);
    await settle();
    expect(remote()).toBe(900);
    await StorageService.syncFromSupabase(MODE);
    expect(local()).toBe(900);
  });

  it('otro equipo con el saldo viejo que anota algo ya no borra el pago', async () => {
    pagarGastoFijo(100);
    await settle();
    expect(remote()).toBe(900);

    comoOtroEquipoConSaldoViejo(1000);
    StorageService.updateAccountBalance('B1', -50, MODE); // ese equipo anota otro gasto de 50
    await settle();
    // Antes Supabase quedaba en 950 (el saldo viejo − 50) y el pago de 100 desaparecía
    expect(remote()).toBe(850);
    expect(local()).toBe(850);
  });

  it('sin conexión el pago queda pendiente y se suma cuando vuelve, sin pisar lo de otros', async () => {
    fake.offline = true;
    pagarGastoFijo(100);
    await settle();
    expect(remote()).toBe(1000);
    // Mientras tanto otro equipo movió la cuenta en Supabase
    fake.remote[0].current_balance = 1200;
    fake.offline = false;
    await StorageService.syncFromSupabase(MODE);
    await settle();
    expect(remote()).toBe(1100);
    await StorageService.syncFromSupabase(MODE);
    expect(local()).toBe(1100);
  });
});
