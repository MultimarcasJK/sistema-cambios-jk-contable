import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account } from '@/types';

// Supabase falso: ninguna tabla responde, todo queda local
vi.mock('../src/lib/supabase-sync', () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop.startsWith('fetch')) return async () => null;
        return async () => true;
      },
    }
  );
  return { SupabaseSyncService: proxy };
});

import { StorageService } from '@/lib/storage';
import { setActor } from '@/lib/actor';
import { buildLedger, entryIsBalanced } from '@/lib/ledger';

const MODE = 'mayor' as const;

function seedAccount(balance: number) {
  const acc: Account = {
    id: 'acc-usd',
    name: 'PICHINCHA',
    currency: 'USD',
    type: 'banco',
    current_balance: balance,
    initial_balance: balance,
    created_at: '2026-10-01T00:00:00Z',
    is_active: true,
  } as Account;
  localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([acc]));
}

function nuevaRemesa(fiado: number) {
  return StorageService.createRemesa(
    {
      remitente_id: 'rem-1',
      remitente_name: 'LUIS TORRES',
      beneficiario: { id: 'ben-1', name: 'MARIA', country: 'VENEZUELA' },
      pais_pago: 'VENEZUELA',
      moneda_origen: 'USD',
      monto_enviar: 100,
      comision: 5,
      total_cobrado: 105,
      monto_fiado: fiado,
      fiado_usd: fiado,
      tasa_cliente: 40,
      moneda_pago: 'VES',
      monto_pago: 4000,
      tasa_costo: 42,
      tasa_origen_usd: 1,
      costo_usd: 95.2381,
      ganancia_usd: 9.7619,
      cuenta_cobro_id: 'acc-usd',
      metodo_pago: 'cuenta_propia',
    },
    MODE
  );
}

const balance = () => StorageService.getAccounts(MODE).find((a) => a.id === 'acc-usd')!.current_balance;
const deuda = () => StorageService.getDebtors(MODE).find((d) => d.client_name === 'LUIS TORRES')?.current_debt;

beforeEach(() => {
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
  seedAccount(1000);
});

describe('remesas fiadas', () => {
  it('solo entra a la cuenta lo cobrado y lo fiado va a Deudores', () => {
    nuevaRemesa(30);
    expect(balance()).toBe(1075);
    expect(deuda()).toBe(30);
  });

  it('al anular se devuelve solo lo cobrado y la deuda desaparece', () => {
    const r = nuevaRemesa(30);
    StorageService.changeRemesaEstado(r.id, 'anulada', { nota: 'prueba' }, MODE);
    expect(balance()).toBe(1000);
    expect(deuda() ?? 0).toBe(0);
  });

  it('los asientos quedan balanceados y la cuenta cuadra con el libro', () => {
    const r = nuevaRemesa(30);
    nuevaRemesa(0);
    StorageService.changeRemesaEstado(r.id, 'anulada', { nota: 'prueba' }, MODE);
    const led = buildLedger(StorageService.getLedgerSources());
    expect(led.asientos.every(entryIsBalanced)).toBe(true);
    expect(led.cuadre.every((c) => Math.abs(c.diferencia) < 0.005)).toBe(true);
  });

  it('no deja fiar más que el total', () => {
    expect(() => nuevaRemesa(200)).toThrow();
  });
});

describe('cambiar remitente de una remesa', () => {
  it('la deuda fiada pasa al remitente nuevo y el saldo no cambia', () => {
    const r = nuevaRemesa(30);
    StorageService.renameRemesaRemitente(r.id, 'ana perez', MODE);
    const saved = StorageService.getRemesas(MODE).find((x) => x.id === r.id)!;
    expect(saved.remitente_name).toBe('ANA PEREZ');
    expect(saved.remitente_id).not.toBe('rem-1');
    expect(deuda() ?? 0).toBe(0);
    expect(StorageService.getDebtors(MODE).find((d) => d.client_name === 'ANA PEREZ')?.current_debt).toBe(30);
    expect(balance()).toBe(1075);
  });
});
