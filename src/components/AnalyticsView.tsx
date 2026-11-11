'use client';

import React, { useMemo, useState } from 'react';
import {
  Account,
  AppMode,
  DailyClosure,
  Debtor,
  Expense,
  Remesa,
  ServiceExpense,
  Supplier,
  TransactionDetal,
  TransactionMayor,
} from '@/types';
import { StorageService } from '@/lib/storage';
import { RatesService } from '@/lib/rates-service';
import { formatCurrency } from '@/lib/formatters';
import { localDateStr } from '@/lib/dates';
import { estadoDelMes } from '@/lib/gastos-fijos';
import { antiguedadCartera } from '@/lib/deudas-fechas';
import {
  Periodo,
  rangoPeriodo,
  gananciaPorDia,
  resumenPeriodo,
  variacion,
  liquidezPorMoneda,
  topClientes,
  resumenRemesas,
  resumenProveedores,
  cuadreUltimosDias,
  ventasPorMoneda,
  diaSinCierre,
  sumarDias,
} from '@/lib/dashboard-metrics';
import { TabKey } from './Navigation';
import { AlertTriangle, ArrowLeftRight, CalendarX, ChevronDown, FileText, Scale, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { AccountStatementModal } from './AccountStatementModal';

interface Props {
  accounts: Account[];
  suppliers: Supplier[];
  debtors: Debtor[];
  detalTxs: TransactionDetal[];
  mayorTxs: TransactionMayor[];
  expenses: Expense[];
  closures: DailyClosure[];
  remesas: Remesa[];
  serviceExpenses: ServiceExpense[];
  appMode: AppMode;
  onNavigate: (tab: TabKey) => void;
}

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: 'mes', label: 'Mes' },
  { key: 'rango', label: 'Rango' },
];

const COLORES = { mayor: '#1e3a8a', detal: '#60a5fa', remesas: '#f59e0b', gastos: '#be123c' };

const usd = (n: number, dec = 2) => `${n < 0 ? '−' : ''}$${formatCurrency(Math.abs(n), dec)}`;
const fechaCorta = (d: string) => {
  const [, m, day] = d.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(day)} ${meses[Number(m) - 1] || ''}`;
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 ${className}`}>{children}</div>;
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: 'dark' | 'bad' }) {
  const dark = tone === 'dark';
  return (
    <div className={`rounded-2xl p-4 flex flex-col gap-1 ${dark ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 shadow-sm'}`}>
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-2xl font-black font-mono ${dark ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-700' : 'text-slate-900'}`}>{value}</span>
      {sub && <span className={`text-xs ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{sub}</span>}
    </div>
  );
}

function Barra({ partes }: { partes: { pct: number; color: string; label: string }[] }) {
  return (
    <div className="flex h-3.5 rounded-full overflow-hidden gap-0.5 bg-slate-100">
      {partes
        .filter((p) => p.pct > 0)
        .map((p) => (
          <div key={p.label} style={{ width: `${p.pct}%`, background: p.color }} title={p.label} />
        ))}
    </div>
  );
}

// Dashboard del administrador: tendencias del período, de dónde sale la ganancia, liquidez,
// cartera por cobrar con antigüedad, proveedores, gastos fijos, remesas y cuadre de caja.
export function AnalyticsView({
  accounts,
  suppliers,
  debtors,
  detalTxs,
  mayorTxs,
  expenses,
  closures,
  remesas,
  serviceExpenses,
  appMode,
  onNavigate,
}: Props) {
  const hoy = localDateStr();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [desde, setDesde] = useState(sumarDias(hoy, -29));
  const [hasta, setHasta] = useState(hoy);
  const [verNegativas, setVerNegativas] = useState(false);
  const [cuentaEstado, setCuentaEstado] = useState<Account | null>(null);
  const rango = useMemo(() => rangoPeriodo(periodo, hoy, desde, hasta), [periodo, hoy, desde, hasta]);

  const fuentes = useMemo(() => ({ detalTxs, mayorTxs, remesas, expenses }), [detalTxs, mayorTxs, remesas, expenses]);
  const actual = useMemo(() => resumenPeriodo(fuentes, rango.desde, rango.hasta), [fuentes, rango]);
  const anterior = useMemo(() => resumenPeriodo(fuentes, rango.prevDesde, rango.prevHasta), [fuentes, rango]);
  const varNeta = variacion(actual.neta, anterior.neta);

  // El gráfico muestra al menos los últimos 30 días cuando el período es corto
  const grafDesde = periodo === 'hoy' || periodo === '7d' ? sumarDias(hoy, -29) : rango.desde;
  const grafHasta = periodo === 'hoy' || periodo === '7d' ? hoy : rango.hasta;
  const dias = useMemo(() => gananciaPorDia(fuentes, grafDesde, grafHasta), [fuentes, grafDesde, grafHasta]);
  const maxDia = Math.max(1, ...dias.map((d) => Math.max(d.detal + d.mayor + d.remesas, d.gastos, 0)));

  const tasaUsd = (code: string): number | null => {
    if (code === 'USD' || code === 'USDT') return 1;
    const r = RatesService.liveCostRate(code, appMode);
    const n = r ? Number(r) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const liquidez = useMemo(() => liquidezPorMoneda(accounts, tasaUsd), [accounts, appMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const liquidezUsd = liquidez.reduce((s, m) => s + (m.usd || 0), 0);
  const maxLiq = Math.max(1, ...liquidez.map((m) => Math.abs(m.usd || 0)));

  const debtPayments = useMemo(() => StorageService.getDebtPayments(appMode), [appMode, debtors]);
  const cartera = useMemo(
    () => antiguedadCartera(debtors, { detalTxs, mayorTxs, remesas, payments: debtPayments }, hoy),
    [debtors, detalTxs, mayorTxs, remesas, debtPayments, hoy]
  );
  const topDeudores = useMemo(
    () => [...debtors].filter((d) => (d.current_debt || 0) > 0).sort((a, b) => b.current_debt - a.current_debt).slice(0, 5),
    [debtors]
  );
  const abonosPeriodo = debtPayments
    .filter((p) => p && p.date >= rango.desde && p.date <= rango.hasta)
    .reduce((s, p) => s + (p.amount || 0), 0);

  const porPagar = suppliers.reduce((s, x) => s + Math.max(0, x.current_debt_usd || 0), 0);
  const topProveedores = [...suppliers].filter((s) => (s.current_debt_usd || 0) > 0).sort((a, b) => b.current_debt_usd - a.current_debt_usd).slice(0, 4);
  const prov = useMemo(
    () => resumenProveedores(StorageService.getSupplierPurchases(appMode), StorageService.getSupplierPayments(appMode), rango.desde, rango.hasta),
    [appMode, rango, suppliers]
  );

  const mes = hoy.slice(0, 7);
  const fijos = useMemo(() => estadoDelMes(StorageService.getGastosFijos(appMode), serviceExpenses, mes, hoy), [appMode, serviceExpenses, mes, hoy]);
  const fijosCount = { pagado: 0, pendiente: 0, vencido: 0 };
  fijos.forEach((f) => (fijosCount[f.estado] += 1));

  const rem = useMemo(() => resumenRemesas(remesas, rango.desde, rango.hasta), [remesas, rango]);
  const cuadre = useMemo(() => cuadreUltimosDias(StorageService.getDailyReports(appMode), hoy, 7), [appMode, hoy, closures, accounts]);
  const cuadraron = cuadre.filter((c) => c.cuadra === true).length;
  const conReporte = cuadre.filter((c) => c.cuadra !== null).length;
  const ultimoDescuadre = [...cuadre].reverse().find((c) => c.cuadra === false);

  const ventasMoneda = useMemo(() => ventasPorMoneda(fuentes, rango.desde, rango.hasta), [fuentes, rango]);
  const ventasMonedaUsd = ventasMoneda.reduce((s, m) => s + m.usd, 0);
  const maxVenta = Math.max(1, ...ventasMoneda.map((m) => m.usd));

  const clientes = useMemo(() => topClientes({ detalTxs, mayorTxs }, debtors, rango.desde, rango.hasta), [detalTxs, mayorTxs, debtors, rango]);

  const ayer = sumarDias(hoy, -1);
  const huboMovAyer = resumenPeriodo(fuentes, ayer, ayer).operaciones > 0;
  const negativas = accounts
    .filter((a) => a.is_active !== false && (a.current_balance || 0) < -0.005)
    .sort((a, b) => (a.country || '').localeCompare(b.country || '') || (a.current_balance || 0) - (b.current_balance || 0));

  const alertas: { key: string; texto: string; tono: 'rojo' | 'naranja' | 'azul'; tab: TabKey }[] = [];
  if (fijosCount.vencido > 0)
    alertas.push({ key: 'fijos', texto: `${fijosCount.vencido} gasto${fijosCount.vencido === 1 ? '' : 's'} fijo${fijosCount.vencido === 1 ? '' : 's'} vencido${fijosCount.vencido === 1 ? '' : 's'}`, tono: 'naranja', tab: 'payroll' });
  if (ultimoDescuadre) alertas.push({ key: 'cuadre', texto: `El cuadre del ${fechaCorta(ultimoDescuadre.date)} no cuadró`, tono: 'rojo', tab: 'closures' });
  if (huboMovAyer && diaSinCierre(closures, ayer)) alertas.push({ key: 'cierre', texto: 'Ayer quedó sin cierre', tono: 'azul', tab: 'closures' });
  if (negativas.length > 0)
    alertas.push({ key: 'neg', texto: `${negativas.length} cuenta${negativas.length === 1 ? '' : 's'} con saldo negativo`, tono: 'rojo', tab: 'accounts' });
  if (cartera.mas30 > 0) alertas.push({ key: 'mora', texto: `${usd(cartera.mas30)} por cobrar con más de 30 días`, tono: 'naranja', tab: 'debtors' });

  const tonos = {
    rojo: 'bg-rose-50 border-rose-200 text-rose-800',
    naranja: 'bg-orange-50 border-orange-200 text-orange-800',
    azul: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const totalUnidades = Math.max(0.01, actual.mayor + actual.detal + actual.remesas);
  const pct = (n: number, t: number) => (t > 0 ? Math.max(0, (n / t) * 100) : 0);
  const carteraTotal = Math.max(0.01, cartera.total);

  return (
    <div className="space-y-5">
      {/* Encabezado y período */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">Dashboard</h2>
          <p className="text-xs text-slate-500">
            {rango.desde === rango.hasta ? fechaCorta(rango.desde) : `${fechaCorta(rango.desde)} – ${fechaCorta(rango.hasta)}`} · comparado con{' '}
            {rango.prevDesde === rango.prevHasta ? fechaCorta(rango.prevDesde) : `${fechaCorta(rango.prevDesde)} – ${fechaCorta(rango.prevHasta)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-200 rounded-xl p-1 gap-0.5" role="group" aria-label="Período">
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodo(p.key)}
                aria-pressed={periodo === p.key}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${periodo === p.key ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-300'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodo === 'rango' && (
            <div className="flex items-center gap-1.5 text-xs">
              <label className="sr-only" htmlFor="dash-desde">Desde</label>
              <input id="dash-desde" type="date" value={desde} max={hoy} onChange={(e) => setDesde(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5" />
              <span className="text-slate-500">a</span>
              <label className="sr-only" htmlFor="dash-hasta">Hasta</label>
              <input id="dash-hasta" type="date" value={hasta} max={hoy} onChange={(e) => setHasta(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5" />
            </div>
          )}
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alertas.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => (a.key === 'neg' ? setVerNegativas((v) => !v) : onNavigate(a.tab))}
              aria-expanded={a.key === 'neg' ? verNegativas : undefined}
              className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs font-semibold hover:brightness-95 ${tonos[a.tono]}`}
            >
              {a.key === 'cierre' ? <CalendarX className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {a.texto}
              {a.key === 'neg' && <ChevronDown className={`w-3.5 h-3.5 transition-transform ${verNegativas ? 'rotate-180' : ''}`} />}
            </button>
          ))}
        </div>
      )}

      {/* Detalle de cuentas con saldo negativo */}
      {verNegativas && negativas.length > 0 && (
        <div className="bg-white border border-rose-200 rounded-2xl p-4" data-testid="cuentas-negativas">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-black text-rose-800">Cuentas con saldo negativo</h3>
            <button type="button" onClick={() => onNavigate('accounts')} className="text-xs font-bold text-blue-700 hover:underline">
              Ir a Cuentas
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {negativas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCuentaEstado(c)}
                title="Ver estado de cuenta"
                className="w-full flex items-center justify-between gap-3 py-2 text-left hover:bg-rose-50 rounded-lg px-2"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 truncate">{c.name}</span>
                  <span className="block text-xs text-slate-500 truncate">
                    {[c.country, c.bank_name, c.responsible].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm font-bold text-rose-700">
                    −{formatCurrency(Math.abs(c.current_balance || 0), 2)} {c.currency}
                  </span>
                  <FileText className="w-4 h-4 text-slate-400" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {cuentaEstado && (
        <AccountStatementModal
          isOpen={!!cuentaEstado}
          onClose={() => setCuentaEstado(null)}
          account={cuentaEstado}
          allAccounts={accounts}
          onSelectAccount={(acc) => setCuentaEstado(acc)}
        />
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="col-span-2 lg:col-span-1">
          <Kpi
            tone="dark"
            label="Ganancia neta"
            value={usd(actual.neta)}
            sub={
              varNeta === null ? (
                'sin datos del período anterior'
              ) : (
                <span className="inline-flex items-center gap-1">
                  {varNeta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {varNeta >= 0 ? '+' : ''}
                  {formatCurrency(varNeta, 1)}% vs. antes ({usd(anterior.neta)})
                </span>
              )
            }
          />
        </div>
        <Kpi label="Volumen operado" value={usd(actual.volumen, 0)} sub={`${actual.operaciones} operaciones`} />
        <Kpi label="Margen promedio" value={`${formatCurrency(actual.margen, 2)}%`} sub="ganancia ÷ volumen" />
        <Kpi label="Gastos" value={usd(actual.gastos)} tone="bad" sub={`${actual.gastosCount} gasto${actual.gastosCount === 1 ? '' : 's'}`} />
        <Kpi label="Posición neta" value={usd(liquidezUsd + cartera.total - porPagar, 0)} sub="caja + por cobrar − por pagar" />
      </div>

      {/* Tendencia y composición */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-slate-900">Ganancia por día</h3>
            <div className="flex flex-wrap gap-3 text-[11px] font-semibold text-slate-600">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORES.mayor }} />Ventas</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORES.detal }} />Cripto</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORES.remesas }} />Remesas</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: COLORES.gastos }} />Gastos</span>
            </div>
          </div>
          <div className="h-48 flex items-end gap-[2px] border-b border-slate-300">
            {dias.map((d) => {
              const h = (n: number) => `${(Math.max(0, n) / maxDia) * 100}%`;
              return (
                <div
                  key={d.date}
                  className="flex-1 min-w-0 h-full flex flex-col justify-end relative group"
                  title={`${fechaCorta(d.date)} · Ventas ${usd(d.mayor)} · Cripto ${usd(d.detal)} · Remesas ${usd(d.remesas)} · Gastos ${usd(d.gastos)} · Neta ${usd(d.neta)}`}
                >
                  <div style={{ height: h(d.remesas), background: COLORES.remesas }} className="rounded-t-sm" />
                  <div style={{ height: h(d.detal), background: COLORES.detal }} />
                  <div style={{ height: h(d.mayor), background: COLORES.mayor }} />
                  {d.gastos > 0 && (
                    <div className="absolute left-[10%] right-[10%] h-0.5" style={{ bottom: h(d.gastos), background: COLORES.gastos }} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-1.5">
            <span>{fechaCorta(grafDesde)}</span>
            <span>máx. {usd(maxDia, 0)}/día</span>
            <span>{fechaCorta(grafHasta)}</span>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-slate-900 mb-3">¿De dónde viene la ganancia?</h3>
          <Barra
            partes={[
              { pct: pct(actual.mayor, totalUnidades), color: COLORES.mayor, label: 'Ventas' },
              { pct: pct(actual.detal, totalUnidades), color: COLORES.detal, label: 'Cripto' },
              { pct: pct(actual.remesas, totalUnidades), color: COLORES.remesas, label: 'Remesas' },
            ]}
          />
          <div className="mt-3 space-y-2 text-sm">
            {[
              ['Ventas', actual.mayor],
              ['Cripto', actual.detal],
              ['Remesas', actual.remesas],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between">
                <span className="font-semibold text-slate-700">{l}</span>
                <span className="font-mono">
                  {usd(v as number)} · {Math.round(pct(v as number, totalUnidades))}%
                </span>
              </div>
            ))}
            <div className="flex justify-between text-slate-500">
              <span>Otros ingresos</span>
              <span className="font-mono">+{usd(actual.ingresos)}</span>
            </div>
            <div className="flex justify-between text-rose-700">
              <span>Gastos</span>
              <span className="font-mono">−{usd(actual.gastos)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-black">
              <span>Ganancia neta</span>
              <span className="font-mono">{usd(actual.neta)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Liquidez, ventas por moneda, por cobrar, por pagar, gastos fijos, remesas, cuadre y mejores clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-blue-600" /> Liquidez por moneda
            </h3>
            <span className="font-mono font-black text-slate-900">≈ {usd(liquidezUsd, 0)}</span>
          </div>
          <div className="space-y-2.5">
            {liquidez.map((m) => (
              <button key={m.code} type="button" onClick={() => onNavigate('accounts')} className="w-full text-left">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-800">{m.code}</span>
                  <span className="font-mono text-slate-600">
                    {formatCurrency(m.local, 2)} {m.usd !== null && m.code !== 'USD' ? <>≈ <strong className="text-slate-900">{usd(m.usd, 0)}</strong></> : m.usd === null ? <em className="text-slate-400">sin tasa</em> : null}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full mt-1">
                  <div className="h-2 rounded-full" style={{ width: `${(Math.abs(m.usd || 0) / maxLiq) * 100}%`, background: (m.usd || 0) < 0 ? COLORES.gastos : COLORES.mayor }} />
                </div>
              </button>
            ))}
            {liquidez.length === 0 && <p className="text-sm text-slate-500">No hay cuentas activas.</p>}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">Convertido con la tasa de costo cargada hoy.</p>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4 text-blue-600" /> Ventas por moneda
            </h3>
            <span className="font-mono font-black text-slate-900">≈ {usd(ventasMonedaUsd, 0)}</span>
          </div>
          <div className="space-y-2.5">
            {ventasMoneda.map((m) => (
              <div key={m.code}>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {m.code} <span className="font-normal text-slate-400">· {m.operaciones} op.</span>
                  </span>
                  <span className="font-mono text-slate-600">
                    {formatCurrency(m.cantidad, 2)} ≈ <strong className="text-slate-900">{usd(m.usd, 0)}</strong>
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full mt-1">
                  <div className="h-2 rounded-full" style={{ width: `${(m.usd / maxVenta) * 100}%`, background: COLORES.mayor }} />
                </div>
              </div>
            ))}
            {ventasMoneda.length === 0 && <p className="text-sm text-slate-500">No hay ventas en este período.</p>}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">Ventas del período: Detal (USDT), Mayor y remesas. El ≈ es lo cobrado en USD.</p>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Por cobrar</h3>
            <span className="font-mono font-black text-emerald-700">{usd(cartera.total)}</span>
          </div>
          <Barra
            partes={[
              { pct: pct(cartera.hasta7, carteraTotal), color: '#93c5fd', label: '0–7 días' },
              { pct: pct(cartera.hasta30, carteraTotal), color: '#f59e0b', label: '8–30 días' },
              { pct: pct(cartera.mas30, carteraTotal), color: '#9a3412', label: '+30 días' },
              { pct: pct(cartera.sinFecha, carteraTotal), color: '#94a3b8', label: 'Sin fecha' },
            ]}
          />
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] font-semibold text-slate-600">
            <span>0–7 días {usd(cartera.hasta7, 0)}</span>
            <span>8–30 días {usd(cartera.hasta30, 0)}</span>
            <span>+30 días {usd(cartera.mas30, 0)}</span>
            {cartera.sinFecha > 0 && <span>Sin fecha {usd(cartera.sinFecha, 0)}</span>}
          </div>
          <div className="mt-3 divide-y divide-slate-100 text-sm">
            {topDeudores.map((d) => (
              <button key={d.id} type="button" onClick={() => onNavigate('debtors')} className="w-full flex justify-between py-2 text-left hover:text-blue-700">
                <span className="truncate pr-2">{d.client_name}</span>
                <span className="font-mono font-bold">{usd(d.current_debt)}</span>
              </button>
            ))}
            {topDeudores.length === 0 && <p className="py-2 text-slate-500">Nadie debe.</p>}
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-2">
            <span>Abonos cobrados en el período</span>
            <strong className="font-mono">{usd(abonosPeriodo)}</strong>
          </div>
        </Card>

        <Card>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Por pagar a proveedores</h3>
            <span className="font-mono font-black text-rose-700">{usd(porPagar)}</span>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            {topProveedores.map((s) => (
              <button key={s.id} type="button" onClick={() => onNavigate('suppliers')} className="w-full flex justify-between py-2 text-left hover:text-blue-700">
                <span className="truncate pr-2">{s.name}</span>
                <span className="font-mono font-bold">{usd(s.current_debt_usd)}</span>
              </button>
            ))}
            {topProveedores.length === 0 && <p className="py-2 text-slate-500">No se le debe a ningún proveedor.</p>}
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between"><span>Compras del período</span><strong className="font-mono">{usd(prov.compras)}</strong></div>
            <div className="flex justify-between"><span>Pagos del período</span><strong className="font-mono">{usd(prov.pagos)}</strong></div>
            <div className="flex justify-between"><span>Comisiones banco/wallet</span><strong className="font-mono">{usd(prov.comisiones)}</strong></div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-slate-900 mb-3">Gastos fijos del mes</h3>
          {fijos.length === 0 ? (
            <p className="text-sm text-slate-500">No hay gastos fijos cargados.</p>
          ) : (
            <>
              <Barra
                partes={[
                  { pct: pct(fijosCount.pagado, fijos.length), color: '#047857', label: 'Pagados' },
                  { pct: pct(fijosCount.pendiente, fijos.length), color: '#cbd5e1', label: 'Pendientes' },
                  { pct: pct(fijosCount.vencido, fijos.length), color: COLORES.gastos, label: 'Vencidos' },
                ]}
              />
              <div className="flex flex-wrap gap-3 mt-2 text-[11px] font-semibold text-slate-600">
                <span>Pagados {fijosCount.pagado}</span>
                <span>Pendientes {fijosCount.pendiente}</span>
                <span>Vencidos {fijosCount.vencido}</span>
              </div>
              <div className="mt-3 divide-y divide-slate-100 text-sm">
                {fijos
                  .filter((f) => f.estado !== 'pagado')
                  .slice(0, 4)
                  .map((f) => (
                    <button key={f.fijo.id} type="button" onClick={() => onNavigate('payroll')} className="w-full flex justify-between gap-2 py-2 text-left">
                      <span className="truncate">{f.fijo.name}</span>
                      <span className={`shrink-0 text-xs font-bold ${f.estado === 'vencido' ? 'text-rose-700' : 'text-slate-500'}`}>
                        {f.estado === 'vencido' ? 'Vencido' : 'Vence'} día {Number(f.vence.slice(8))}
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-slate-900 mb-3">Remesas del período</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Enviadas', String(rem.enviadas), 'text-slate-900'],
              ['Por pagar', String(rem.pendientes), 'text-amber-700'],
              ['Monto', usd(rem.montoUsd, 0), 'text-slate-900'],
              ['Ganancia', usd(rem.ganancia), 'text-emerald-700'],
            ].map(([l, v, c]) => (
              <button key={l} type="button" onClick={() => onNavigate('remesas')} className="bg-slate-50 rounded-xl p-2.5 text-left">
                <div className="text-[11px] font-semibold text-slate-500">{l}</div>
                <div className={`text-lg font-black font-mono ${c}`}>{v}</div>
              </button>
            ))}
          </div>
          {rem.destinos.length > 0 && (
            <p className="text-xs text-slate-600 mt-3">Destinos: {rem.destinos.map((d) => `${d.pais} ${d.pct}%`).join(' · ')}</p>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-blue-600" /> Cuadre de caja (7 días)
          </h3>
          <div className="grid grid-cols-7 gap-1.5">
            {cuadre.map((c) => (
              <button key={c.date} type="button" onClick={() => onNavigate('closures')} className="flex flex-col items-center gap-1" title={c.diferencias.map((x) => `${x.name}: ${x.diferencia} ${x.currency}`).join('\n') || undefined}>
                <span
                  className={`w-full h-9 rounded-lg flex items-center justify-center text-sm font-black text-white ${
                    c.cuadra === true ? 'bg-emerald-700' : c.cuadra === false ? 'bg-rose-700' : 'bg-slate-300'
                  }`}
                >
                  {c.cuadra === true ? '✓' : c.cuadra === false ? '✕' : '–'}
                </span>
                <span className="text-[10px] text-slate-500">{c.date === hoy ? 'hoy' : fechaCorta(c.date)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-3">
            {conReporte === 0
              ? 'No hay reportes del día con cuadre en esta semana.'
              : `${cuadraron} de ${conReporte} días con reporte cuadraron.`}
            {ultimoDescuadre && ultimoDescuadre.diferencias[0] && (
              <> Último descuadre: {ultimoDescuadre.diferencias[0].name} {formatCurrency(ultimoDescuadre.diferencias[0].diferencia, 2)} {ultimoDescuadre.diferencias[0].currency}.</>
            )}
          </p>
        </Card>

        {/* Mejores clientes */}
        <Card className="md:col-span-2">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Mejores clientes del período</h3>
          {clientes.length === 0 ? (
            <p className="text-sm text-slate-500">No hay ventas en este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 font-semibold">Cliente</th>
                    <th className="py-2 font-semibold">Operaciones</th>
                    <th className="py-2 font-semibold">Volumen</th>
                    <th className="py-2 font-semibold">Ganancia</th>
                    <th className="py-2 font-semibold">Debe</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.name} className="border-t border-slate-100">
                      <td className="py-2 font-semibold text-slate-800">{c.name}</td>
                      <td className="py-2">{c.operaciones}</td>
                      <td className="py-2 font-mono">{usd(c.volumen, 0)}</td>
                      <td className="py-2 font-mono font-bold text-emerald-700">{usd(c.ganancia)}</td>
                      <td className="py-2 font-mono">{c.debe > 0 ? usd(c.debe) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
