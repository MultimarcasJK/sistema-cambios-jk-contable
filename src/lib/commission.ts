import { TransactionMayor } from '@/types';

// Comisión del intermediario/banco en una venta regional.
// Ventas nuevas guardan commission_account: lo que sale de la cuenta de salida, en su moneda.
// Ventas viejas no lo traen: antes solo salía de la cuenta cuando era en USD.
export function commissionOutOfAccount(
  tx: Pick<TransactionMayor, 'commission' | 'commission_account'>,
  accountCurrency?: string
): number {
  if (tx.commission_account !== undefined && tx.commission_account !== null) return tx.commission_account || 0;
  return accountCurrency === 'USD' ? tx.commission || 0 : 0;
}

// Pasa la comisión a la moneda de la cuenta de salida.
// En % se toma sobre el monto que sale (ej. 0.30% de 72,960 Bs = 218.88 Bs);
// fija en $ se convierte con la tasa de costo (monto / costo en USD).
export function commissionInAccountCurrency(opts: {
  accountCurrency?: string;
  amount: number;
  costUsd: number;
  feeUsd: number;
  percent?: number;
}): number {
  const { accountCurrency, amount, costUsd, feeUsd, percent } = opts;
  if (!accountCurrency) return 0;
  let value: number;
  if (accountCurrency === 'USD') value = feeUsd;
  else if (percent && percent > 0) value = (amount * percent) / 100;
  else value = costUsd > 0 ? feeUsd * (amount / costUsd) : 0;
  return Number(value.toFixed(2));
}
