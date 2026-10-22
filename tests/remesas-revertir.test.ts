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
  const ves: Account = {
    id: 'acc-ves',
    name: 'BANESCO',
    currency: 'VES',
    type: 'banco',
    current_balance: 50000,
    initial_balance: 50000,
    created_at: '2026-10-01T00:00:00Z',
    is_active: true,
  } as Account;
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
  localStorage.setItem(StorageService.getAccountsKey(MODE), JSON.stringify([acc, ves]));
}

function nuevaRemesa(fiado = 0) {
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
      cuenta_pago_id: 'acc-ves',
    },
    MODE
  );
}

const saldo = (id: string) => StorageService.getAccounts(MODE).find((a) => a.id === id)!.current_balance;
const pagar = (id: string) =>
  StorageService.changeRemesaEstado(id, 'pagada', { metodo_pago: 'cuenta_propia', cuenta_pago_id: 'acc-ves' }, MODE);

beforeEach(() => {
  localStorage.clear();
  setActor({ id: 'u1', email: 'admin@test', rol: 'ADMIN' });
  seedAccount(1000);
});

describe('revertir pago de remesa', () => {
  it('devuelve lo pagado a la cuenta y la remesa vuelve a cobrada', () => {
    const r = nuevaRemesa();
    pagar(r.id);
    expect(saldo('acc-ves')).toBe(46000);
    const rev = StorageService.revertirPagoRemesa(r.id, 'pagada por error', MODE);
    expect(rev.estado).toBe('cobrada');
    expect(rev.fecha_pago).toBeUndefined();
    expect(saldo('acc-ves')).toBe(50000);
    expect(rev.pagos_revertidos).toHaveLength(1);
  });

  it('después se puede anular y devuelve también lo cobrado', () => {
    const r = nuevaRemesa();
    pagar(r.id);
    StorageService.revertirPagoRemesa(r.id, 'error', MODE);
    StorageService.changeRemesaEstado(r.id, 'anulada', { nota: 'error' }, MODE);
    expect(saldo('acc-usd')).toBe(1000);
    expect(saldo('acc-ves')).toBe(50000);
  });

  it('pagar, revertir y volver a pagar deja el libro cuadrado', () => {
    const r = nuevaRemesa();
    pagar(r.id);
    StorageService.revertirPagoRemesa(r.id, 'cuenta equivocada', MODE);
    pagar(r.id);
    const led = buildLedger(StorageService.getLedgerSources());
    expect(led.asientos.every(entryIsBalanced)).toBe(true);
    expect(led.cuadre.every((c) => Math.abs(c.diferencia) < 0.005)).toBe(true);
    expect(saldo('acc-ves')).toBe(46000);
  });

  it('solo ADMIN, con motivo y solo si está pagada', () => {
    const r = nuevaRemesa();
    expect(() => StorageService.revertirPagoRemesa(r.id, 'x', MODE)).toThrow();
    pagar(r.id);
    expect(() => StorageService.revertirPagoRemesa(r.id, '  ', MODE)).toThrow();
    setActor({ id: 'u2', email: 'op@test', rol: 'OPERADOR' } as any);
    expect(() => StorageService.revertirPagoRemesa(r.id, 'x', MODE)).toThrow();
    expect(saldo('acc-ves')).toBe(46000);
  });
});
