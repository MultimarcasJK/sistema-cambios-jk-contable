'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Account, AppMode, Currency, GastoFijo, ServiceCategory, ServiceExpense } from '@/types';
import { StorageService } from '@/lib/storage';
import { CurrencyService } from '@/lib/currencies';
import { formatInputNumber, parseFormattedNumber } from '@/lib/formatters';
import { localDateStr } from '@/lib/dates';
import { estadoDelMes, GastoFijoDelMes, resumenMensual } from '@/lib/gastos-fijos';
import { SearchableSelect } from '@/components/SearchableSelect';
import { CalendarClock, CheckCircle2, Clock, AlertCircle, Edit2, Trash2, Plus, PieChart, X } from 'lucide-react';

interface Props {
  accounts: Account[];
  serviceExpenses: ServiceExpense[];
  categories: { key: ServiceCategory; label: string; badgeClass: string }[];
  appMode: AppMode;
  isDark: boolean;
  // Abre el formulario de pago con todo ya lleno; fecha = día en que se registra el pago
  onPagar: (fijo: GastoFijo, fecha: string) => void;
}

const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const nombreMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formVacio = {
  id: '',
  name: '',
  category: 'ALQUILER_CUENTAS' as ServiceCategory,
  amount: '',
  currency: 'USD' as Currency,
  account_id: '',
  day_of_month: '1',
  notes: '',
};

export function GastosFijosPanel({ accounts, serviceExpenses, categories, appMode, isDark, onPagar }: Props) {
  const hoy = localDateStr();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [fijos, setFijos] = useState<GastoFijo[]>([]);
  const [form, setForm] = useState(formVacio);
  const [formAbierto, setFormAbierto] = useState(false);

  // Se vuelve a leer cuando cambian los gastos (después de pagar o de sincronizar)
  useEffect(() => {
    setFijos(StorageService.getGastosFijos(appMode));
  }, [appMode, serviceExpenses]);

  const lista = useMemo(() => estadoDelMes(fijos, serviceExpenses, mes, hoy), [fijos, serviceExpenses, mes, hoy]);
  const resumen = useMemo(() => resumenMensual(serviceExpenses, mes), [serviceExpenses, mes]);

  const totalFijosUsd = lista.reduce((s, x) => s + x.pagado_usd, 0);
  const pendientes = lista.filter((x) => x.estado !== 'pagado');
  const pendientesPorMoneda = pendientes.reduce<Record<string, number>>((acc, x) => {
    acc[x.fijo.currency] = (acc[x.fijo.currency] || 0) + x.fijo.amount;
    return acc;
  }, {});

  const catDe = (key: string) => categories.find((c) => c.key === key);
  const cuentaDe = (id?: string) => accounts.find((a) => a.id === id);

  const cuentasDeMoneda = accounts.filter((a) => a.is_active && a.currency === form.currency);
  const otrasCuentas = accounts.filter((a) => a.is_active && a.currency !== form.currency);

  const abrirNuevo = () => {
    setForm(formVacio);
    setFormAbierto(true);
  };

  const abrirEditar = (f: GastoFijo) => {
    setForm({
      id: f.id,
      name: f.name,
      category: f.category,
      amount: formatInputNumber(String(f.amount)),
      currency: f.currency,
      account_id: f.account_id || '',
      day_of_month: String(f.day_of_month),
      notes: f.notes || '',
    });
    setFormAbierto(true);
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFormattedNumber(form.amount);
    const dia = parseInt(form.day_of_month, 10);
    if (!form.name.trim()) return alert('Escribe el nombre del gasto fijo (ej. Alquiler cuenta Banesco).');
    if (!(amount > 0)) return alert('Escribe el monto mensual.');
    if (!(dia >= 1 && dia <= 31)) return alert('El día de pago debe estar entre 1 y 31.');
    const prev = fijos.find((f) => f.id === form.id);
    StorageService.saveGastoFijo(
      {
        id: form.id || undefined,
        name: form.name.trim().toUpperCase(),
        category: form.category,
        amount,
        currency: form.currency,
        account_id: form.account_id || undefined,
        day_of_month: dia,
        is_active: prev ? prev.is_active : true,
        notes: form.notes.trim() || undefined,
      },
      appMode
    );
    setFijos(StorageService.getGastosFijos(appMode));
    setFormAbierto(false);
  };

  const borrar = (f: GastoFijo) => {
    if (!confirm(`¿Eliminar el gasto fijo "${f.name}"?\n\nLos pagos que ya hiciste se quedan en el historial.`)) return;
    StorageService.deleteGastoFijo(f.id, appMode);
    setFijos(StorageService.getGastosFijos(appMode));
  };

  const pagar = (x: GastoFijoDelMes) => {
    // Mes actual: se paga hoy. Otro mes: se registra en su día de pago, para que cuente en ese mes.
    onPagar(x.fijo, mes === hoy.slice(0, 7) ? hoy : x.vence);
  };

  const card = `p-5 rounded-2xl border shadow-sm space-y-4 ${
    isDark ? 'bg-slate-900/90 border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
  }`;
  const input = `w-full text-xs rounded-xl px-3 py-2 border font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500 ${
    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
  }`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="space-y-6">
      {/* Gastos fijos del mes */}
      <div className={card}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <CalendarClock className="w-5 h-5 text-purple-500" />
            <div>
              <h3 className="text-sm font-bold">Gastos fijos del mes</h3>
              <p className={`text-xs ${muted}`}>Alquiler de cuentas, costos bancarios y todo lo que pagas cada mes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className={`${input} w-auto`} />
            <button
              type="button"
              onClick={abrirNuevo}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo gasto fijo
            </button>
          </div>
        </div>

        {formAbierto && (
          <form
            onSubmit={guardar}
            className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-purple-50/50 border-purple-100'}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{form.id ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</span>
              <button type="button" onClick={() => setFormAbierto(false)} className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold mb-1">Nombre *</label>
                <input
                  type="text"
                  placeholder="Ej. Alquiler cuenta Banesco de JOSÉ"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={input}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Categoría *</label>
                <SearchableSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ServiceCategory })} className={input}>
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </SearchableSelect>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Día de pago (1-31) *</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.day_of_month}
                  onChange={(e) => setForm({ ...form, day_of_month: e.target.value })}
                  className={input}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Monto mensual *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: formatInputNumber(e.target.value) })}
                  className={`${input} font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Moneda *</label>
                <SearchableSelect
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value as Currency, account_id: '' })}
                  className={input}
                >
                  {CurrencyService.getCurrencies().map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </SearchableSelect>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold mb-1">Cuenta de donde se paga</label>
                <SearchableSelect value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className={input}>
                  <option value="">Elegir al pagar</option>
                  {cuentasDeMoneda.length > 0 && (
                    <optgroup label={`Cuentas en ${form.currency}`}>
                      {cuentasDeMoneda.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.bank_name})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otrasCuentas.length > 0 && (
                    <optgroup label="Otras monedas">
                      {otrasCuentas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.bank_name}) - {a.currency}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </SearchableSelect>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-bold mb-1">Notas</label>
                <input
                  type="text"
                  placeholder="Ej. dueño de la cuenta, teléfono, a quién se le paga…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={input}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer">
                Guardar gasto fijo
              </button>
            </div>
          </form>
        )}

        {/* Totales del mes */}
        {lista.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-emerald-50/60 border-emerald-100'}`}>
              <span className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Pagados</span>
              <div className="text-lg font-black font-mono">
                {lista.length - pendientes.length} de {lista.length}
              </div>
              <span className={`text-[10px] ${muted}`}>${fmt(totalFijosUsd)} USD pagados</span>
            </div>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-amber-50/60 border-amber-100'}`}>
              <span className="text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400 block">Por pagar</span>
              <div className="text-sm font-black font-mono">
                {pendientes.length === 0
                  ? 'Nada'
                  : Object.entries(pendientesPorMoneda)
                      .map(([cur, monto]) => `${cur} ${fmt(monto)}`)
                      .join(' · ')}
              </div>
              <span className={`text-[10px] ${muted}`}>{pendientes.length} pendientes</span>
            </div>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-rose-50/60 border-rose-100'}`}>
              <span className="text-[11px] font-bold uppercase text-rose-600 dark:text-rose-400 block">Vencidos</span>
              <div className="text-lg font-black font-mono">{lista.filter((x) => x.estado === 'vencido').length}</div>
              <span className={`text-[10px] ${muted}`}>Pasó su día de pago</span>
            </div>
          </div>
        )}

        {lista.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 italic">
            {fijos.length === 0
              ? 'Todavía no tienes gastos fijos. Crea el primero con "Nuevo gasto fijo" (ej. alquiler de una cuenta, mantenimiento del banco).'
              : `No hay gastos fijos para ${nombreMes(mes)}.`}
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map((x) => {
              const cat = catDe(x.fijo.category);
              const cta = cuentaDe(x.fijo.account_id);
              const badge =
                x.estado === 'pagado'
                  ? { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', icon: <CheckCircle2 className="w-3 h-3" />, txt: 'Pagado' }
                  : x.estado === 'vencido'
                  ? { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300', icon: <AlertCircle className="w-3 h-3" />, txt: 'Vencido' }
                  : { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300', icon: <Clock className="w-3 h-3" />, txt: 'Pendiente' };
              return (
                <div
                  key={x.fijo.id}
                  className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl border ${
                    isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold truncate">{x.fijo.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cat?.badgeClass || ''}`}>{cat?.label.split('(')[0] || x.fijo.category}</span>
                      {x.fijo.is_active === false && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">Pausado</span>}
                    </div>
                    <div className={`text-[11px] ${muted}`}>
                      Día {x.fijo.day_of_month} · {cta ? `${cta.name} (${cta.bank_name})` : 'Cuenta al pagar'}
                      {x.fijo.notes ? ` · ${x.fijo.notes}` : ''}
                    </div>
                    {x.estado === 'pagado' && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        Pagado el {x.pagos.map((p) => p.date).join(', ')} · {x.pagos.map((p) => `${p.currency} ${fmt(p.amount)}`).join(' + ')}
                      </div>
                    )}
                  </div>
                  <div className="font-mono font-black text-sm whitespace-nowrap">
                    {x.fijo.currency} {fmt(x.fijo.amount)}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${badge.cls}`}>
                    {badge.icon}
                    {badge.txt}
                  </span>
                  <div className="flex items-center gap-1">
                    {x.estado !== 'pagado' && (
                      <button
                        type="button"
                        onClick={() => pagar(x)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      >
                        Pagar
                      </button>
                    )}
                    <button type="button" onClick={() => abrirEditar(x.fijo)} title="Editar" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => borrar(x.fijo)} title="Eliminar" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resumen mensual */}
      <div className={card}>
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <PieChart className="w-5 h-5 text-purple-500" />
            <div>
              <h3 className="text-sm font-bold">Resumen de {nombreMes(mes)}</h3>
              <p className={`text-xs ${muted}`}>Todo lo pagado en servicios y gastos fijos ese mes</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 whitespace-nowrap">
            ${fmt(resumen.total_usd)} USD
          </span>
        </div>

        {resumen.count === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 italic">No hay gastos registrados en {nombreMes(mes)}.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500 mb-2">Por categoría</div>
              <div className="space-y-1.5">
                {resumen.porCategoria.map((c) => {
                  const pct = resumen.total_usd > 0 ? (c.total_usd / resumen.total_usd) * 100 : 0;
                  return (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">
                          {catDe(c.category)?.label.split('(')[0] || c.category} <span className={muted}>({c.count})</span>
                        </span>
                        <span className="font-mono font-bold">${fmt(c.total_usd)}</span>
                      </div>
                      <div className={`h-1.5 rounded-full mt-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500 mb-2">Por cuenta</div>
              <div className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {resumen.porCuenta.map((c) => {
                  const cta = cuentaDe(c.account_id);
                  return (
                    <div key={`${c.account_id}|${c.currency}`} className="flex items-center justify-between py-1.5 text-xs gap-2">
                      <span className="font-semibold truncate">
                        {cta ? `${cta.name} (${cta.bank_name})` : 'Sin cuenta'} <span className={muted}>({c.count})</span>
                      </span>
                      <span className="text-right whitespace-nowrap">
                        <span className="font-mono font-bold">
                          {c.currency} {fmt(c.monto)}
                        </span>
                        {c.currency !== 'USD' && <span className={`block text-[10px] ${muted}`}>${fmt(c.total_usd)} USD</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
