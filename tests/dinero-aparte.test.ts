import { describe, expect, it } from 'vitest';
import { APARTE_CONCEPT, aparteBalances, isAparte } from '@/lib/aparte';
import { buildLedger, LedgerSources } from '@/lib/ledger';
import { Account, Expense } from '@/types';

const cuenta: Account = {
  id: 'acc-cop',
  name: 'BANCOLOMBIA',
  bank_name: 'BANCOLOMBIA',
  currency: 'COP',
  type: 'banco',
  responsible: 'JK',
  current_balance: 300000,
  initial_balance: 0,
  is_active: true,
};

const mov = (id: string, type: 'ingreso' | 'egreso', amount: number, concept = APARTE_CONCEPT): Expense => ({
  id,
  date: '2026-10-24',
  type,
  description: 'PAGO SERVICIO',
  amount,
  currency: 'COP',
  concept,
  account_id: cuenta.id,
  amount_usd: amount / 4000,
  created_at: '2026-10-24T15:00:00.000Z',
});

const vacio = { detalTxs: [], mayorTxs: [], transfers: [], purchases: [], supplierPayments: [], debtPayments: [], adjustments: [] };

describe('Dinero aparte', () => {
  it('reconoce el concepto sin importar mayúsculas o espacios', () => {
    expect(isAparte({ concept: ' dinero aparte ' })).toBe(true);
    expect(isAparte({ concept: 'INGRESO EXTRA' })).toBe(false);
  });

  it('calcula lo que queda aparte por moneda', () => {
    const b = aparteBalances([mov('e1', 'ingreso', 500000), mov('e2', 'egreso', 200000), mov('e3', 'ingreso', 9, 'INGRESO EXTRA')]);
    expect(b.get('COP')).toBe(300000);
  });

  it('va a la cuenta "Dinero aparte" y no a ingresos ni gastos en la contabilidad', () => {
    const src: LedgerSources = {
      accounts: [cuenta],
      byMode: {
        detal: { ...vacio, expenses: [mov('e1', 'ingreso', 500000), mov('e2', 'egreso', 200000)] },
        mayor: { ...vacio, expenses: [] },
      },
    };
    const { asientos, cuentas, cuadre } = buildLedger(src);
    const lineas = asientos.flatMap((a) => a.lineas);
    expect(lineas.some((l) => ['ingreso', 'gasto'].includes(cuentas.get(l.cuenta)!.tipo))).toBe(false);
    const aparte = lineas.filter((l) => l.cuenta === 'APARTE');
    expect(aparte.reduce((s, l) => s + l.haber - l.debe, 0)).toBe(300000);
    expect(cuadre.find((c) => c.account.id === cuenta.id)?.libro).toBe(300000);
  });
});
