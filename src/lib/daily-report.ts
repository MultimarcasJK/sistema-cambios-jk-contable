import {
  Account,
  AppMode,
  DailyReport,
  DailyReportCuadreLinea,
  DebtPayment,
  Expense,
  Remesa,
  TransactionDetal,
  TransactionMayor,
} from '@/types';
import { isAparte } from './aparte';
import { gananciaRemesasEl, remesasPagadasEl } from './remesa-profit';
import { LedgerEntry } from './ledger';

// Reporte del día de la operadora: mismo formato para DETAL y MAYOR.
// Lógica pura (sin localStorage ni Supabase) para poder probarla.

// Por debajo de esto la diferencia del cuadre se considera cero (redondeo)
export const CUADRE_TOLERANCIA = 0.005;

const r2 = (n: number) => Number((n || 0).toFixed(2));

// Lo que quedó debiendo el cliente en una venta (en USD, como lo cuenta Deudores)
export function deudaDeVenta(t: { total_to_pay: number; amount_received?: number; payment_status?: TransactionDetal['payment_status'] }): number {
  if (t.payment_status === 'PENDIENTE') return t.total_to_pay || 0;
  if (t.payment_status === 'PARCIAL') return Math.max(0, (t.total_to_pay || 0) - (t.amount_received || 0));
  return 0;
}

// Cuadre de caja: solo cuentan las cuentas donde la operadora escribió el saldo real.
// diferencia = real - libro (negativo = falta dinero, positivo = sobra).
export function cuadreDeCaja(accounts: Account[], reales: Record<string, number | undefined>): DailyReportCuadreLinea[] {
  return accounts
    .filter((a) => reales[a.id] !== undefined && reales[a.id] !== null && !Number.isNaN(reales[a.id]))
    .map((a) => {
      const libro = r2(Number(a.current_balance || 0));
      const real = r2(Number(reales[a.id]));
      return {
        account_id: a.id,
        name: a.name || a.bank_name,
        currency: a.currency,
        libro,
        real,
        diferencia: r2(real - libro),
      };
    });
}

export function lineaCuadra(l: Pick<DailyReportCuadreLinea, 'diferencia'>): boolean {
  return Math.abs(l.diferencia) < CUADRE_TOLERANCIA;
}

// "Cuadra", "Falta 10.00 VES" o "Sobra 5.00 USD"
export function textoDiferencia(l: Pick<DailyReportCuadreLinea, 'diferencia' | 'currency'>): string {
  if (lineaCuadra(l)) return 'Cuadra';
  const monto = Math.abs(l.diferencia).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${l.diferencia < 0 ? 'Falta' : 'Sobra'} ${monto} ${l.currency}`;
}

// Cuentas que tuvieron algún movimiento ese día (ventas, traspasos, gastos, abonos, remesas…),
// sacadas del libro contable. La apertura (saldo inicial) no cuenta como movimiento.
export function cuentasUsadasEl(asientos: LedgerEntry[], date: string, mode: AppMode): Set<string> {
  const ids = new Set<string>();
  asientos.forEach((e) => {
    if (e.fecha !== date || e.unidad !== mode || e.origen === 'apertura') return;
    e.lineas.forEach((l) => {
      if (l.cuenta.startsWith('CTA:')) ids.add(l.cuenta.slice(4));
    });
  });
  return ids;
}

export interface DailyReportInput {
  id?: string;
  date: string;
  mode: AppMode;
  operadora: string;
  createdAt?: string;
  detalTxs: TransactionDetal[];
  mayorTxs: TransactionMayor[];
  expenses: Expense[];
  remesas: Remesa[];
  debtPayments: DebtPayment[];
  accounts: Account[];
  reales?: Record<string, number | undefined>;
  // Si viene, el reporte solo lleva estas cuentas (más las que la operadora contó)
  usedAccountIds?: Set<string>;
  notes?: string;
}

export function buildDailyReport(input: DailyReportInput): DailyReport {
  const { date } = input;
  const detal = input.detalTxs.filter((t) => t && t.date === date);
  const mayor = input.mayorTxs.filter((t) => t && t.date === date);
  const gastosIngresos = input.expenses.filter((e) => e && e.date === date && !isAparte(e));
  const ingresos = gastosIngresos.filter((e) => e.type === 'ingreso');
  const gastos = gastosIngresos.filter((e) => e.type !== 'ingreso');

  // Monedas regionales agrupadas por moneda
  const porMoneda = new Map<string, { count: number; monto: number }>();
  mayor.forEach((t) => {
    const cur = String(t.currency || 'VES');
    const st = porMoneda.get(cur) || { count: 0, monto: 0 };
    st.count += 1;
    st.monto += t.amount_ves || 0;
    porMoneda.set(cur, st);
  });

  const profitCripto = detal.reduce((s, t) => s + (t.profit_usd || 0), 0);
  const profitRegionales = mayor.reduce((s, t) => s + (t.profit_usd || 0), 0);
  const profitRemesas = gananciaRemesasEl(input.remesas, date);
  const extraIncome = ingresos.reduce((s, e) => s + (e.amount_usd || 0), 0);
  const totalGastos = gastos.reduce((s, e) => s + (e.amount_usd || 0), 0);

  const abonos = input.debtPayments.filter((p) => p && p.date === date);
  const ventasFiadas = [...detal, ...mayor].filter((t) => deudaDeVenta(t) > 0);
  const remesasFiadas = input.remesas.filter(
    (r) => r && r.date === date && r.estado !== 'anulada' && (r.fiado_usd || 0) > 0
  );

  const reales = input.reales || {};
  const contada = (id: string) => reales[id] !== undefined && reales[id] !== null && !Number.isNaN(reales[id]);
  const cuentas = input.accounts.filter(
    (a) => a && a.is_active !== false && (!input.usedAccountIds || input.usedAccountIds.has(a.id) || contada(a.id))
  );
  const totales: Record<string, number> = {};
  cuentas.forEach((a) => {
    totales[a.currency] = r2((totales[a.currency] || 0) + Number(a.current_balance || 0));
  });

  const cuadre = cuadreDeCaja(cuentas, reales);

  return {
    id: input.id || `rep-${Date.now()}`,
    date,
    mode: input.mode,
    operadora: input.operadora,
    created_at: input.createdAt || new Date().toISOString(),
    ventas: {
      cripto: {
        count: detal.length,
        usdt: r2(detal.reduce((s, t) => s + (t.usdt_amount || 0), 0)),
        facturado_usd: r2(detal.reduce((s, t) => s + (t.total_to_pay || 0), 0)),
      },
      regionales: Array.from(porMoneda.entries()).map(([currency, st]) => ({
        currency,
        count: st.count,
        monto: r2(st.monto),
      })),
      remesas_pagadas: remesasPagadasEl(input.remesas, date).length,
    },
    ganancia: {
      cripto: r2(profitCripto),
      regionales: r2(profitRegionales),
      remesas: r2(profitRemesas),
      ingresos_extra: r2(extraIncome),
      gastos: r2(totalGastos),
      neta: r2(profitCripto + profitRegionales + profitRemesas + extraIncome - totalGastos),
    },
    gastos_count: gastos.length,
    ingresos_count: ingresos.length,
    abonos: { count: abonos.length, total_usd: r2(abonos.reduce((s, p) => s + (p.amount || 0), 0)) },
    deudas_nuevas: {
      count: ventasFiadas.length + remesasFiadas.length,
      total_usd: r2(
        ventasFiadas.reduce((s, t) => s + deudaDeVenta(t), 0) +
          remesasFiadas.reduce((s, r) => s + (r.fiado_usd || 0), 0)
      ),
    },
    saldos: cuentas.map((a) => ({
      account_id: a.id,
      name: a.name || a.bank_name,
      bank_name: a.bank_name,
      currency: a.currency,
      balance: r2(Number(a.current_balance || 0)),
    })),
    totales_moneda: totales,
    cuadre,
    // null = la operadora no contó ninguna cuenta
    cuadra: cuadre.length === 0 ? null : cuadre.every(lineaCuadra),
    notes: input.notes || undefined,
  };
}
