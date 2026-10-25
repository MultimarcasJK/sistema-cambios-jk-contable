import { Expense } from '@/types';

// "Dinero aparte": pagos de otros servicios que caen en las cuentas y luego salen.
// Solo mueven el saldo de la cuenta: no son ganancia ni gasto del negocio de cambios.
// Se guardan como gasto/ingreso normal con este concepto fijo (no hace falta otra tabla).
export const APARTE_CONCEPT = 'DINERO APARTE';

export function isAparte(e: Pick<Expense, 'concept'> | null | undefined): boolean {
  return !!e && (e.concept || '').trim().toUpperCase() === APARTE_CONCEPT;
}

// Lo que queda de dinero aparte por moneda: entradas menos salidas
export function aparteBalances(expenses: Expense[]): Map<string, number> {
  const out = new Map<string, number>();
  expenses.forEach((e) => {
    if (!isAparte(e)) return;
    const cur = e.currency || 'USD';
    out.set(cur, (out.get(cur) || 0) + (e.type === 'ingreso' ? e.amount : -e.amount));
  });
  return out;
}
