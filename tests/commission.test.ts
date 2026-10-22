import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commissionInAccountCurrency, commissionOutOfAccount } from '@/lib/commission';
import { packCommissionAccount, packClientFee, unpackCommissionAccount, unpackClientFee } from '@/lib/client-fee';

vi.mock('../src/lib/supabase-sync', () => ({
  SupabaseSyncService: new Proxy({}, { get: (_t, p: string) => (p.startsWith('fetch') ? async () => null : async () => true) }),
}));
import { StorageService } from '@/lib/storage';
import { buildLedger, entryIsBalanced } from '@/lib/ledger';

describe('comisión en la moneda de la cuenta de salida', () => {
  it('0.30% de 72,960 Bs = 218.88 Bs', () => {
    expect(
      commissionInAccountCurrency({ accountCurrency: 'VES', amount: 72960, costUsd: 73.33, feeUsd: 0.23, percent: 0.3 })
    ).toBe(218.88);
  });
  it('fija en $ se pasa a Bs con la tasa de costo', () => {
    expect(commissionInAccountCurrency({ accountCurrency: 'VES', amount: 99500, costUsd: 100, feeUsd: 1 })).toBe(995);
  });
  it('cuenta en USD: sale la comisión en dólares', () => {
    expect(commissionInAccountCurrency({ accountCurrency: 'USD', amount: 100, costUsd: 100, feeUsd: 0.5, percent: 0.5 })).toBe(0.5);
  });
  it('ventas viejas sin el dato: solo en cuentas USD', () => {
    expect(commissionOutOfAccount({ commission: 0.23 }, 'VES')).toBe(0);
    expect(commissionOutOfAccount({ commission: 0.23 }, 'USD')).toBe(0.23);
    expect(commissionOutOfAccount({ commission: 0.23, commission_account: 218.88 }, 'VES')).toBe(218.88);
  });
  it('la marca en notes convive con la del VIP', () => {
    const notes = packCommissionAccount(packClientFee('hola', 1, true), 218.88);
    const ca = unpackCommissionAccount(notes);
    expect(ca.commission_account).toBe(218.88);
    expect(unpackClientFee(ca.notes)).toEqual({ notes: 'hola', client_fee: 1, is_vip: true });
  });
});

describe('venta regional con comisión pagada desde VES', () => {
  const MODE = 'detal' as const;
  const saldo = () => StorageService.getAccounts(MODE).find((a) => a.id === 'ves')!.current_balance;
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      StorageService.getAccountsKey(MODE),
      JSON.stringify([
        { id: 'ves', name: 'BANESCO', currency: 'VES', type: 'banco', current_balance: 100000, initial_balance: 100000, created_at: '2026-10-01T00:00:00Z', is_active: true },
      ])
    );
  });

  it('sale monto + comisión, al borrar se devuelve todo y el libro cuadra', () => {
    const tx = StorageService.addTransactionMayor(
      {
        date: '2026-10-22', client_name: 'ALI UZ', currency: 'VES', amount_ves: 72960, buy_price: 995, sell_price: 960.3,
        total_to_pay: 75.98, received_account_id: 'POR_COBRAR', amount_received: 0, payment_status: 'PENDIENTE',
        paid_account_id: 'ves', commission: 0.23, commission_account: 218.88, profit_usd: 2.42,
      } as any,
      MODE
    );
    expect(saldo()).toBeCloseTo(100000 - 72960 - 218.88, 2);
    const led = buildLedger(StorageService.getLedgerSources());
    expect(led.asientos.every(entryIsBalanced)).toBe(true);
    expect(led.cuadre.every((c) => Math.abs(c.diferencia) < 0.005)).toBe(true);
    StorageService.deleteTransactionMayor(tx.id, MODE);
    expect(saldo()).toBeCloseTo(100000, 2);
  });
});
