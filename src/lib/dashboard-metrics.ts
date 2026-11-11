import {
  Account,
  DailyClosure,
  DailyReport,
  Debtor,
  Expense,
  Remesa,
  SupplierPayment,
  SupplierPurchase,
  TransactionDetal,
  TransactionMayor,
} from '@/types';
import { isAparte } from './aparte';
import { localDateStr } from './dates';

// Cálculos del Dashboard (tendencias por período). Lógica pura para poder probarla.

const r2 = (n: number) => Number((n || 0).toFixed(2));

export type Periodo = 'hoy' | '7d' | 'mes' | 'rango';

export interface Rango {
  desde: string;
  hasta: string;
  prevDesde: string;
  prevHasta: string;
}

function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day, 12);
}

export function sumarDias(d: string, n: number): string {
  const x = parse(d);
  x.setDate(x.getDate() + n);
  return localDateStr(x);
}

export function fechasEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  if (!desde || !hasta || desde > hasta) return out;
  let d = desde;
  while (d <= hasta && out.length < 400) {
    out.push(d);
    d = sumarDias(d, 1);
  }
  return out;
}

// Rango del período y el período anterior de la misma duración (el mes se compara con el mes
// anterior hasta el mismo día)
export function rangoPeriodo(periodo: Periodo, hoy: string, desde?: string, hasta?: string): Rango {
  if (periodo === 'hoy') {
    const ayer = sumarDias(hoy, -1);
    return { desde: hoy, hasta: hoy, prevDesde: ayer, prevHasta: ayer };
  }
  if (periodo === '7d') {
    const d = sumarDias(hoy, -6);
    return { desde: d, hasta: hoy, prevDesde: sumarDias(d, -7), prevHasta: sumarDias(d, -1) };
  }
  if (periodo === 'mes') {
    const d = hoy.slice(0, 8) + '01';
    const prevInicio = sumarDias(d, -1).slice(0, 8) + '01';
    const prevFinMes = sumarDias(d, -1);
    const mismoDia = prevInicio.slice(0, 8) + hoy.slice(8);
    return { desde: d, hasta: hoy, prevDesde: prevInicio, prevHasta: mismoDia < prevFinMes ? mismoDia : prevFinMes };
  }
  let a = desde || hoy;
  let b = hasta || hoy;
  if (a > b) [a, b] = [b, a];
  const dias = fechasEntre(a, b).length || 1;
  return { desde: a, hasta: b, prevDesde: sumarDias(a, -dias), prevHasta: sumarDias(a, -1) };
}

export interface FuentesDashboard {
  detalTxs: TransactionDetal[];
  mayorTxs: TransactionMayor[];
  remesas: Remesa[];
  expenses: Expense[];
}

export interface DiaGanancia {
  date: string;
  detal: number;
  mayor: number;
  remesas: number;
  ingresos: number;
  gastos: number;
  neta: number;
}

// Ganancia de cada día del rango, con las mismas reglas que el Panel y el Cierre:
// ganancia de ventas por fecha, remesas el día que se pagaron, sin "dinero aparte".
export function gananciaPorDia(f: FuentesDashboard, desde: string, hasta: string): DiaGanancia[] {
  const map = new Map<string, DiaGanancia>();
  fechasEntre(desde, hasta).forEach((date) =>
    map.set(date, { date, detal: 0, mayor: 0, remesas: 0, ingresos: 0, gastos: 0, neta: 0 })
  );
  (f.detalTxs || []).forEach((t) => {
    const d = t && map.get(t.date);
    if (d) d.detal += t.profit_usd || 0;
  });
  (f.mayorTxs || []).forEach((t) => {
    const d = t && map.get(t.date);
    if (d) d.mayor += t.profit_usd || 0;
  });
  (f.remesas || []).forEach((r) => {
    if (!r || r.estado !== 'pagada' || !r.fecha_pago) return;
    const d = map.get(r.fecha_pago);
    if (d) d.remesas += r.ganancia_usd || 0;
  });
  (f.expenses || []).forEach((e) => {
    if (!e || isAparte(e)) return;
    const d = map.get(e.date);
    if (!d) return;
    if (e.type === 'ingreso') d.ingresos += e.amount_usd || 0;
    else d.gastos += e.amount_usd || 0;
  });
  return Array.from(map.values()).map((d) => ({
    date: d.date,
    detal: r2(d.detal),
    mayor: r2(d.mayor),
    remesas: r2(d.remesas),
    ingresos: r2(d.ingresos),
    gastos: r2(d.gastos),
    neta: r2(d.detal + d.mayor + d.remesas + d.ingresos - d.gastos),
  }));
}

export interface ResumenPeriodo {
  detal: number;
  mayor: number;
  remesas: number;
  ingresos: number;
  gastos: number;
  neta: number;
  bruta: number; // ganancia de operaciones (sin ingresos extra ni gastos)
  operaciones: number;
  volumen: number; // USD vendidos / cobrados
  margen: number; // % ganancia bruta / volumen
  gastosCount: number;
}

const enRango = (d: string | undefined, desde: string, hasta: string) => !!d && d >= desde && d <= hasta;

export function remesaUsd(r: Remesa): number {
  const tasa = r.tasa_origen_usd || 1;
  return (r.total_cobrado || 0) / tasa;
}

export function resumenPeriodo(f: FuentesDashboard, desde: string, hasta: string): ResumenPeriodo {
  const dias = gananciaPorDia(f, desde, hasta);
  const sum = (k: keyof Omit<DiaGanancia, 'date'>) => r2(dias.reduce((s, d) => s + d[k], 0));
  const detal = (f.detalTxs || []).filter((t) => t && enRango(t.date, desde, hasta));
  const mayor = (f.mayorTxs || []).filter((t) => t && enRango(t.date, desde, hasta));
  const remesas = (f.remesas || []).filter((r) => r && r.estado !== 'anulada' && enRango(r.date, desde, hasta));
  const volumen = r2(
    detal.reduce((s, t) => s + (t.total_to_pay || 0), 0) +
      mayor.reduce((s, t) => s + (t.total_to_pay || 0), 0) +
      remesas.reduce((s, r) => s + remesaUsd(r), 0)
  );
  const bruta = r2(sum('detal') + sum('mayor') + sum('remesas'));
  return {
    detal: sum('detal'),
    mayor: sum('mayor'),
    remesas: sum('remesas'),
    ingresos: sum('ingresos'),
    gastos: sum('gastos'),
    neta: sum('neta'),
    bruta,
    operaciones: detal.length + mayor.length + remesas.length,
    volumen,
    margen: volumen > 0 ? r2((bruta / volumen) * 100) : 0,
    gastosCount: (f.expenses || []).filter((e) => e && e.type !== 'ingreso' && !isAparte(e) && enRango(e.date, desde, hasta)).length,
  };
}

// Variación en % contra el período anterior (null si antes no hubo nada con qué comparar)
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null;
  return r2(((actual - anterior) / Math.abs(anterior)) * 100);
}

export interface MonedaLiquidez {
  code: string;
  local: number;
  usd: number | null; // null si no hay tasa para convertir
  cuentas: number;
}

// Saldos por moneda de las cuentas activas. `unidadesPorUsd` da cuántas unidades de la moneda
// vale 1 USD (null si no hay tasa).
export function liquidezPorMoneda(accounts: Account[], unidadesPorUsd: (code: string) => number | null): MonedaLiquidez[] {
  const map = new Map<string, MonedaLiquidez>();
  (accounts || []).forEach((a) => {
    if (!a || a.is_active === false) return;
    const code = (a.currency || 'USD').toUpperCase();
    const m = map.get(code) || { code, local: 0, usd: 0, cuentas: 0 };
    m.local += a.current_balance || 0;
    m.cuentas += 1;
    map.set(code, m);
  });
  return Array.from(map.values())
    .map((m) => {
      const tasa = unidadesPorUsd(m.code);
      return { ...m, local: r2(m.local), usd: tasa && tasa > 0 ? r2(m.local / tasa) : null };
    })
    .sort((a, b) => (b.usd ?? -Infinity) - (a.usd ?? -Infinity));
}

export interface ClienteTop {
  name: string;
  operaciones: number;
  volumen: number;
  ganancia: number;
  debe: number;
}

export function topClientes(
  f: Pick<FuentesDashboard, 'detalTxs' | 'mayorTxs'>,
  debtors: Debtor[],
  desde: string,
  hasta: string,
  n = 5
): ClienteTop[] {
  const map = new Map<string, ClienteTop>();
  [...(f.detalTxs || []), ...(f.mayorTxs || [])].forEach((t) => {
    if (!t || !enRango(t.date, desde, hasta)) return;
    const name = (t.client_name || '').trim().toUpperCase();
    if (!name) return;
    const c = map.get(name) || { name, operaciones: 0, volumen: 0, ganancia: 0, debe: 0 };
    c.operaciones += 1;
    c.volumen += t.total_to_pay || 0;
    c.ganancia += t.profit_usd || 0;
    map.set(name, c);
  });
  const deuda = new Map((debtors || []).filter(Boolean).map((d) => [(d.client_name || '').trim().toUpperCase(), d.current_debt || 0]));
  return Array.from(map.values())
    .map((c) => ({ ...c, volumen: r2(c.volumen), ganancia: r2(c.ganancia), debe: r2(Math.max(0, deuda.get(c.name) || 0)) }))
    .sort((a, b) => b.ganancia - a.ganancia || b.volumen - a.volumen)
    .slice(0, n);
}

export interface ResumenRemesas {
  enviadas: number;
  pendientes: number; // cobradas o en proceso, aún sin pagar al beneficiario (todas, no solo del período)
  montoUsd: number;
  ganancia: number;
  destinos: { pais: string; count: number; pct: number }[];
}

export function resumenRemesas(remesas: Remesa[], desde: string, hasta: string): ResumenRemesas {
  const del = (remesas || []).filter((r) => r && r.estado !== 'anulada' && enRango(r.date, desde, hasta));
  const porPais = new Map<string, number>();
  del.forEach((r) => porPais.set(r.pais_pago || 'Otro', (porPais.get(r.pais_pago || 'Otro') || 0) + 1));
  return {
    enviadas: del.length,
    pendientes: (remesas || []).filter((r) => r && (r.estado === 'cobrada' || r.estado === 'en_proceso')).length,
    montoUsd: r2(del.reduce((s, r) => s + remesaUsd(r), 0)),
    ganancia: r2(
      (remesas || [])
        .filter((r) => r && r.estado === 'pagada' && enRango(r.fecha_pago, desde, hasta))
        .reduce((s, r) => s + (r.ganancia_usd || 0), 0)
    ),
    destinos: Array.from(porPais.entries())
      .map(([pais, count]) => ({ pais, count, pct: del.length ? Math.round((count / del.length) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4),
  };
}

export interface ResumenProveedores {
  compras: number;
  pagos: number;
  comisiones: number;
}

export function resumenProveedores(
  compras: SupplierPurchase[],
  pagos: SupplierPayment[],
  desde: string,
  hasta: string
): ResumenProveedores {
  const p = (pagos || []).filter((x) => x && enRango(x.date, desde, hasta));
  return {
    compras: r2((compras || []).filter((x) => x && !String(x.id || '').startsWith('adj-') && enRango(x.date, desde, hasta)).reduce((s, x) => s + (x.cost_usd || 0), 0)),
    pagos: r2(p.reduce((s, x) => s + (x.amount_usd || 0), 0)),
    comisiones: r2(p.reduce((s, x) => s + (x.commission_usd || 0), 0)),
  };
}

export interface DiaCuadre {
  date: string;
  cuadra: boolean | null; // null: no hubo reporte con cuadre ese día
  diferencias: { name: string; currency: string; diferencia: number }[];
}

// Último reporte de cada día (de los últimos `n` días hasta hoy) y si cuadró
export function cuadreUltimosDias(reports: DailyReport[], hoy: string, n = 7): DiaCuadre[] {
  return fechasEntre(sumarDias(hoy, -(n - 1)), hoy).map((date) => {
    const delDia = (reports || [])
      .filter((r) => r && r.date === date)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
    const conCuadre = delDia && delDia.cuadre && delDia.cuadre.length > 0;
    return {
      date,
      cuadra: conCuadre ? delDia.cuadra ?? null : null,
      diferencias: conCuadre
        ? delDia.cuadre
            .filter((l) => Math.abs(l.diferencia || 0) > 0.005)
            .map((l) => ({ name: l.name, currency: l.currency, diferencia: r2(l.diferencia) }))
        : [],
    };
  });
}

export function diaSinCierre(closures: DailyClosure[], date: string): boolean {
  return !(closures || []).some((c) => c && c.date === date);
}

export interface VentaMoneda {
  code: string;
  cantidad: number; // total entregado en la moneda vendida
  usd: number; // lo que se cobró por esa cantidad, en USD
  operaciones: number;
}

// Cuánto se vendió de cada moneda en el período: USDT del Detal, la moneda de cada venta al
// Mayor (VES por defecto) y lo que se entregó en remesas (moneda de pago, sin anuladas).
export function ventasPorMoneda(
  f: Pick<FuentesDashboard, 'detalTxs' | 'mayorTxs' | 'remesas'>,
  desde: string,
  hasta: string
): VentaMoneda[] {
  const map = new Map<string, VentaMoneda>();
  const sumar = (code: string, cantidad: number, usd: number) => {
    const c = (code || 'VES').toUpperCase();
    const m = map.get(c) || { code: c, cantidad: 0, usd: 0, operaciones: 0 };
    m.cantidad += cantidad || 0;
    m.usd += usd || 0;
    m.operaciones += 1;
    map.set(c, m);
  };
  (f.detalTxs || []).forEach((t) => {
    if (t && enRango(t.date, desde, hasta)) sumar('USDT', t.usdt_amount, t.total_to_pay);
  });
  (f.mayorTxs || []).forEach((t) => {
    if (t && enRango(t.date, desde, hasta)) sumar(String(t.currency || 'VES'), t.amount_ves, t.total_to_pay);
  });
  (f.remesas || []).forEach((r) => {
    if (!r || r.estado === 'anulada' || !enRango(r.date, desde, hasta)) return;
    sumar(String(r.moneda_pago || 'VES'), r.monto_pago, (r.monto_enviar || 0) / (r.tasa_origen_usd || 1));
  });
  return Array.from(map.values())
    .map((m) => ({ ...m, cantidad: r2(m.cantidad), usd: r2(m.usd) }))
    .filter((m) => m.operaciones > 0)
    .sort((a, b) => b.usd - a.usd);
}
