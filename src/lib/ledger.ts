import {
  Account,
  AppMode,
  BalanceAdjustment,
  BalanceTransfer,
  DebtPayment,
  Expense,
  SupplierPayment,
  SupplierPurchase,
  TransactionDetal,
  TransactionMayor,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Libro contable de partida doble.
//
// Cada operación del sistema (venta, traspaso, gasto, compra, abono, ajuste…)
// se convierte en un asiento con líneas al Debe y al Haber. Los asientos se
// arman a partir de las operaciones guardadas, así que el libro siempre refleja
// exactamente lo registrado: si se anula una operación, su asiento desaparece.
//
// Regla: dentro de cada asiento, en cada moneda, Debe = Haber. Cuando una
// operación cruza monedas (cobro en USD, pago en VES) la diferencia de cada
// moneda pasa por la cuenta "Puente cambiario", como hace un contador.
// ─────────────────────────────────────────────────────────────────────────────

export type LedgerAccountType = 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'gasto' | 'orden';

export interface LedgerAccountDef {
  key: string;
  codigo: string;
  nombre: string;
  tipo: LedgerAccountType;
  moneda?: string; // fija para bancos y wallets; libre para las demás
  operativaId?: string; // id de la cuenta bancaria/wallet del sistema
}

export interface LedgerLine {
  cuenta: string; // key de LedgerAccountDef
  moneda: string;
  debe: number;
  haber: number;
  tercero?: string;
}

export type LedgerOrigin =
  | 'apertura'
  | 'venta_detal'
  | 'venta_mayor'
  | 'traspaso'
  | 'gasto'
  | 'ingreso'
  | 'compra_proveedor'
  | 'pago_proveedor'
  | 'abono_cliente'
  | 'ajuste';

export interface LedgerEntry {
  id: string;
  fecha: string;
  orden: string; // para ordenar dentro del día
  unidad: AppMode;
  origen: LedgerOrigin;
  origenId: string;
  descripcion: string;
  lineas: LedgerLine[];
}

export interface LedgerSources {
  accounts: Account[];
  byMode: Record<
    AppMode,
    {
      detalTxs: TransactionDetal[];
      mayorTxs: TransactionMayor[];
      transfers: BalanceTransfer[];
      expenses: Expense[];
      purchases: SupplierPurchase[];
      supplierPayments: SupplierPayment[];
      debtPayments: DebtPayment[];
      adjustments: BalanceAdjustment[];
    }
  >;
}

export interface AccountReconciliation {
  account: Account;
  libro: number;
  registrado: number;
  diferencia: number;
}

export interface Ledger {
  cuentas: Map<string, LedgerAccountDef>;
  asientos: LedgerEntry[];
  cuadre: AccountReconciliation[];
}

// Cuentas fijas del plan
export const PLAN_FIJO: LedgerAccountDef[] = [
  { key: 'SIN_CUENTA', codigo: '1.1.99', nombre: 'Cuenta no indicada', tipo: 'activo' },
  { key: 'CXC', codigo: '1.2.01', nombre: 'Cuentas por cobrar clientes', tipo: 'activo' },
  { key: 'CXP', codigo: '2.1.01', nombre: 'Cuentas por pagar proveedores', tipo: 'pasivo' },
  { key: 'APERTURA', codigo: '3.1.01', nombre: 'Saldos iniciales (capital)', tipo: 'patrimonio' },
  { key: 'ING_DETAL', codigo: '4.1.01', nombre: 'Ganancia ventas detal', tipo: 'ingreso' },
  { key: 'ING_MAYOR', codigo: '4.1.02', nombre: 'Ganancia ventas mayor', tipo: 'ingreso' },
  { key: 'ING_OTROS', codigo: '4.3.01', nombre: 'Otros ingresos', tipo: 'ingreso' },
  { key: 'GTO_COMIS', codigo: '5.1.01', nombre: 'Comisiones bancarias', tipo: 'gasto' },
  { key: 'GTO_OPER', codigo: '5.2.01', nombre: 'Gastos operativos', tipo: 'gasto' },
  { key: 'GTO_SERV', codigo: '5.2.02', nombre: 'Servicios (alquiler, luz, internet…)', tipo: 'gasto' },
  { key: 'GTO_NOMINA', codigo: '5.3.01', nombre: 'Nómina', tipo: 'gasto' },
  { key: 'AJUSTES', codigo: '5.9.01', nombre: 'Ajustes y diferencias de saldo', tipo: 'gasto' },
  { key: 'PUENTE', codigo: '9.9.01', nombre: 'Puente cambiario', tipo: 'orden' },
];

const TYPE_CODE: Record<string, string> = {
  banco: '1.1.01',
  wallet: '1.1.02',
  efectivo: '1.1.03',
  zelle: '1.1.04',
  otro: '1.1.05',
};

export function accountKey(accountId: string): string {
  return 'CTA:' + accountId;
}

const EPS = 0.00005;

function round4(n: number): number {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

function timeOf(createdAt?: string): string {
  return createdAt ? createdAt.slice(11, 19) : '00:00:00';
}

// Agrega una línea al Debe (monto > 0) o al Haber (monto < 0)
function push(lines: LedgerLine[], cuenta: string, moneda: string, monto: number, tercero?: string) {
  const m = round4(monto);
  if (Math.abs(m) < EPS) return;
  lines.push({
    cuenta,
    moneda,
    debe: m > 0 ? m : 0,
    haber: m < 0 ? -m : 0,
    tercero,
  });
}

// Cierra cada moneda del asiento contra el puente cambiario
function balance(lines: LedgerLine[]): LedgerLine[] {
  const net = new Map<string, number>();
  lines.forEach((l) => net.set(l.moneda, (net.get(l.moneda) || 0) + l.debe - l.haber));
  net.forEach((diff, moneda) => {
    if (Math.abs(diff) >= EPS) push(lines, 'PUENTE', moneda, -diff);
  });
  return lines;
}

export function entryIsBalanced(entry: LedgerEntry): boolean {
  const net = new Map<string, number>();
  entry.lineas.forEach((l) => net.set(l.moneda, (net.get(l.moneda) || 0) + l.debe - l.haber));
  return Array.from(net.values()).every((v) => Math.abs(v) < 0.001);
}

function expenseAccount(exp: Expense): string {
  const concept = (exp.concept || '').toUpperCase();
  if (concept.startsWith('NÓMINA') || concept.startsWith('NOMINA')) return 'GTO_NOMINA';
  if (concept.startsWith('SERVICIOS')) return 'GTO_SERV';
  return 'GTO_OPER';
}

export function buildLedger(src: LedgerSources): Ledger {
  const cuentas = new Map<string, LedgerAccountDef>();
  PLAN_FIJO.forEach((c) => cuentas.set(c.key, c));

  // Una subcuenta por banco/wallet/caja, con su moneda fija
  const counters: Record<string, number> = {};
  const accById = new Map<string, Account>();
  src.accounts.forEach((acc) => {
    if (!acc || !acc.id || accById.has(acc.id)) return;
    accById.set(acc.id, acc);
    const base = TYPE_CODE[acc.type] || TYPE_CODE.otro;
    counters[base] = (counters[base] || 0) + 1;
    cuentas.set(accountKey(acc.id), {
      key: accountKey(acc.id),
      codigo: base + '.' + String(counters[base]).padStart(2, '0'),
      nombre: acc.name + (acc.bank_name && acc.bank_name !== acc.name ? ' · ' + acc.bank_name : ''),
      tipo: 'activo',
      moneda: acc.currency,
      operativaId: acc.id,
    });
  });

  // Cuenta operativa → key + moneda (si fue borrada, se crea una cuenta "eliminada")
  const real = (accountId?: string): { key: string; moneda: string } | null => {
    if (!accountId || accountId === 'POR_COBRAR') return null;
    const acc = accById.get(accountId);
    const key = accountKey(accountId);
    if (!acc) {
      if (!cuentas.has(key)) {
        cuentas.set(key, {
          key,
          codigo: '1.1.98',
          nombre: 'Cuenta eliminada (' + accountId + ')',
          tipo: 'activo',
          operativaId: accountId,
        });
      }
      return { key, moneda: 'USD' };
    }
    return { key, moneda: acc.currency };
  };

  const asientos: LedgerEntry[] = [];
  const add = (e: Omit<LedgerEntry, 'lineas'>, lineas: LedgerLine[]) => {
    if (lineas.length === 0) return;
    asientos.push({ ...e, lineas: balance(lineas) });
  };

  // 0. Apertura: saldo inicial de cada cuenta contra capital
  accById.forEach((acc) => {
    const ini = Number(acc.initial_balance) || 0;
    if (Math.abs(ini) < EPS) return;
    const lines: LedgerLine[] = [];
    push(lines, accountKey(acc.id), acc.currency, ini);
    push(lines, 'APERTURA', acc.currency, -ini);
    add(
      {
        id: 'ap-' + acc.id,
        fecha: acc.created_at ? acc.created_at.slice(0, 10) : '2000-01-01',
        orden: '00:00:00',
        unidad: (acc.scope === 'mayor' ? 'mayor' : 'detal') as AppMode,
        origen: 'apertura',
        origenId: acc.id,
        descripcion: 'Saldo inicial de ' + acc.name,
      },
      lines
    );
  });

  (['detal', 'mayor'] as AppMode[]).forEach((unidad) => {
    const d = src.byMode[unidad];
    if (!d) return;

    // 1. Ventas detal (USDT / dólar)
    d.detalTxs.forEach((tx) => {
      if (!tx) return;
      const lines: LedgerLine[] = [];
      const rec = real(tx.received_account_id);
      if (rec && tx.amount_received > 0) push(lines, rec.key, rec.moneda, tx.amount_received);
      const paid = real(tx.paid_account_id);
      if (paid && tx.usdt_amount > 0) {
        push(lines, paid.key, paid.moneda, -(tx.usdt_amount + (tx.bank_fee || 0)));
        push(lines, 'GTO_COMIS', paid.moneda, tx.bank_fee || 0);
      }
      const unpaid = round4((tx.total_to_pay || 0) - (tx.amount_received || 0));
      if (unpaid > 0.005) push(lines, 'CXC', 'USD', unpaid, tx.client_name);
      push(lines, 'ING_DETAL', 'USD', -(tx.profit_usd || 0));
      add(
        {
          id: 'as-' + tx.id,
          fecha: tx.date,
          orden: timeOf(tx.created_at),
          unidad,
          origen: 'venta_detal',
          origenId: tx.id,
          descripcion: `Venta detal a ${tx.client_name || 'cliente'} · ${tx.usdt_amount} USDT`,
        },
        lines
      );
    });

    // 2. Ventas mayor (monedas regionales)
    d.mayorTxs.forEach((tx) => {
      if (!tx) return;
      const lines: LedgerLine[] = [];
      const paid = real(tx.paid_account_id);
      if (paid && tx.amount_ves > 0) {
        const commission = paid.moneda === 'USD' ? tx.commission || 0 : 0;
        push(lines, paid.key, paid.moneda, -(tx.amount_ves + commission));
        push(lines, 'GTO_COMIS', paid.moneda, commission);
      }
      const receivedAmt = tx.amount_received !== undefined ? tx.amount_received : 0;
      const rec = real(tx.received_account_id);
      if (rec && receivedAmt > 0) push(lines, rec.key, rec.moneda, receivedAmt);
      const unpaid = round4((tx.total_to_pay || 0) - receivedAmt);
      if (unpaid > 0.005) push(lines, 'CXC', 'USD', unpaid, tx.client_name);
      push(lines, 'ING_MAYOR', 'USD', -(tx.profit_usd || 0));
      add(
        {
          id: 'as-' + tx.id,
          fecha: tx.date,
          orden: timeOf(tx.created_at),
          unidad,
          origen: 'venta_mayor',
          origenId: tx.id,
          descripcion: `Venta mayor a ${tx.client_name || 'cliente'} · ${tx.amount_ves} ${tx.currency || 'VES'}`,
        },
        lines
      );
    });

    // 3. Traspasos entre cuentas propias
    d.transfers.forEach((t) => {
      if (!t) return;
      const lines: LedgerLine[] = [];
      const from = real(t.from_account_id);
      const to = real(t.to_account_id);
      if (from) {
        push(lines, from.key, from.moneda, -(t.amount_sent + (t.commission || 0)));
        push(lines, 'GTO_COMIS', from.moneda, t.commission || 0);
      }
      if (to) push(lines, to.key, to.moneda, t.amount_received);
      add(
        {
          id: 'as-' + t.id,
          fecha: t.date,
          orden: timeOf(t.created_at),
          unidad,
          origen: 'traspaso',
          origenId: t.id,
          descripcion: 'Traspaso' + (t.concept ? ': ' + t.concept : ''),
        },
        lines
      );
    });

    // 4. Gastos e ingresos varios (incluye nómina y servicios)
    d.expenses.forEach((exp) => {
      if (!exp) return;
      const lines: LedgerLine[] = [];
      const acc = real(exp.account_id);
      const moneda = acc ? acc.moneda : exp.currency || 'USD';
      const contra = acc ? acc.key : 'SIN_CUENTA';
      if (exp.type === 'ingreso') {
        push(lines, contra, moneda, exp.amount);
        push(lines, 'ING_OTROS', moneda, -exp.amount);
      } else {
        push(lines, expenseAccount(exp), moneda, exp.amount);
        push(lines, contra, moneda, -exp.amount);
      }
      add(
        {
          id: 'as-' + exp.id,
          fecha: exp.date,
          orden: timeOf(exp.created_at),
          unidad,
          origen: exp.type === 'ingreso' ? 'ingreso' : 'gasto',
          origenId: exp.id,
          descripcion: exp.description || exp.concept || (exp.type === 'ingreso' ? 'Ingreso' : 'Gasto'),
        },
        lines
      );
    });

    // 5. Compras a proveedores (entra inventario, sube la deuda)
    d.purchases.forEach((p) => {
      if (!p) return;
      const lines: LedgerLine[] = [];
      const acc = real(p.account_id);
      if (acc && p.quantity > 0) push(lines, acc.key, acc.moneda, p.quantity);
      push(lines, 'CXP', 'USD', -((p.cost_usd || 0) - (p.credited_amount || 0)), p.supplier_name);
      add(
        {
          id: 'as-' + p.id,
          fecha: p.date,
          orden: timeOf(p.created_at),
          unidad,
          origen: 'compra_proveedor',
          origenId: p.id,
          descripcion: `Compra a ${p.supplier_name} · ${p.quantity} ${p.currency}`,
        },
        lines
      );
    });

    // 6. Pagos a proveedores (baja la deuda, sale dinero)
    d.supplierPayments.forEach((p) => {
      if (!p) return;
      const lines: LedgerLine[] = [];
      push(lines, 'CXP', 'USD', p.amount_usd, p.supplier_name);
      const acc = real(p.account_id);
      if (acc && p.amount_usd > 0) push(lines, acc.key, acc.moneda, -p.amount_usd);
      add(
        {
          id: 'as-' + p.id,
          fecha: p.date,
          orden: timeOf(p.created_at),
          unidad,
          origen: 'pago_proveedor',
          origenId: p.id,
          descripcion: `Pago a proveedor ${p.supplier_name}`,
        },
        lines
      );
    });

    // 7. Abonos de clientes deudores
    d.debtPayments.forEach((p) => {
      if (!p) return;
      const lines: LedgerLine[] = [];
      const acc = real(p.account_id);
      const amt = p.amount_currency && p.amount_currency > 0 ? p.amount_currency : p.amount;
      if (acc && amt > 0) push(lines, acc.key, acc.moneda, amt);
      push(lines, 'CXC', 'USD', -(p.amount || 0), p.client_name);
      add(
        {
          id: 'as-' + p.id,
          fecha: p.date,
          orden: timeOf(p.created_at),
          unidad,
          origen: 'abono_cliente',
          origenId: p.id,
          descripcion: `Abono de ${p.client_name}`,
        },
        lines
      );
    });

    // 8. Ajustes de saldo con motivo
    d.adjustments.forEach((a) => {
      if (!a) return;
      const lines: LedgerLine[] = [];
      const acc = real(a.account_id);
      if (!acc) return;
      push(lines, acc.key, acc.moneda, a.delta);
      push(lines, 'AJUSTES', acc.moneda, -a.delta);
      add(
        {
          id: 'as-' + a.id,
          fecha: a.date,
          orden: timeOf(a.created_at),
          unidad,
          origen: 'ajuste',
          origenId: a.id,
          descripcion: `Ajuste de saldo ${a.account_name}: ${a.reason}`,
        },
        lines
      );
    });
  });

  asientos.sort((a, b) => (a.fecha + a.orden).localeCompare(b.fecha + b.orden) || a.id.localeCompare(b.id));

  // Cuadre: saldo según libro contra saldo guardado en la cuenta
  const totals = accountTotals(asientos);
  const cuadre: AccountReconciliation[] = [];
  accById.forEach((acc) => {
    const libro = round4(totals.get(accountKey(acc.id))?.get(acc.currency) || 0);
    const registrado = round4(acc.current_balance || 0);
    cuadre.push({ account: acc, libro, registrado, diferencia: round4(registrado - libro) });
  });

  return { cuentas, asientos, cuadre };
}

// Saldo (Debe − Haber) por cuenta y moneda
export function accountTotals(asientos: LedgerEntry[]): Map<string, Map<string, number>> {
  const totals = new Map<string, Map<string, number>>();
  asientos.forEach((e) =>
    e.lineas.forEach((l) => {
      if (!totals.has(l.cuenta)) totals.set(l.cuenta, new Map());
      const byCur = totals.get(l.cuenta)!;
      byCur.set(l.moneda, (byCur.get(l.moneda) || 0) + l.debe - l.haber);
    })
  );
  return totals;
}

export const ORIGIN_LABELS: Record<LedgerOrigin, string> = {
  apertura: 'Apertura',
  venta_detal: 'Venta detal',
  venta_mayor: 'Venta mayor',
  traspaso: 'Traspaso',
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  compra_proveedor: 'Compra proveedor',
  pago_proveedor: 'Pago proveedor',
  abono_cliente: 'Abono cliente',
  ajuste: 'Ajuste de saldo',
};
